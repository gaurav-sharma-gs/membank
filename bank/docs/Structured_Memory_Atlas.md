# Structured Memory Atlas Design

## 0. Real-World Scenario & Personas

- **Business System**: a twenty-year-old wealth/portfolio management Java monolith with 20+ modules (trade capture, compliance, settlements, reporting, onboarding, billing, model orchestration, etc.) and 50+ distinct "business use cases." Advisors rely on it to trade ETFs, mutual funds, structured notes, and bespoke model portfolios on behalf of end-clients. The stack mixes Struts-era servlets, Spring services, handwritten XML/XSL trade templates, and thousands of conditional branches representing compliance, suitability, and trading logic.
- **Primary Persona**: an engineer using Qodo (with Sonnet 4.5 or GPT‑5) inside IntelliJ to answer "How do we rebalance a model portfolio when ETF drift exceeds 5%?" or "Which modules touch the suitability guardrails for muni bond ladders?". They regularly discover logic that exists today but is undocumented.
- **Existing Tools**:
  - *Memory Bank MCP*: writes markdown files under `mem/<category>` but offers no higher-level organization.
  - *Qodo*: great at temporary reasoning but forgets runs between sessions.
- **Pain**:
  - Every investigation produces new ad-hoc markdown files that nobody can rediscover.
  - When 50+ developers commit daily, previous answers quickly become stale.
  - Regulatory audits and onboarding require curated flows/rules/data paths, not scattered documents.

This document therefore defines an "atlas" layer—the authoritative structured library of flows, rules, and data paths that survives across sessions and humans. A new contributor should be able to read this file and implement both the software and the operating procedures without prior tribal knowledge.

## 1. Background & Motivation

- **Legacy domain**: A 20+ year Java monolith packs business flows, rules, XSL templates, and bespoke eligibility logic that are painful to rediscover each session.
- **Current behavior**: The existing Memory Bank MCP module writes raw markdown documents under `mem/<category>/<document>.md`. Tools such as Qodo can request new files at will, creating a sprawl of minimally structured notes.
- **Observed gaps**
  - No durable structured memory of flows, rules, data paths, and module summaries.
  - Repeated rediscovery because Qodo's in-session retrieval forgets prior findings.
  - Markdown proliferation; nothing links disparate documents or surfaces related material.
  - No shared index that can answer "show me every rebalance or suitability rule" without remembering the file path.
- **Goal**: Layer a structured/indexed "atlas" on top of the existing document store so reusable knowledge is saved once, searchable forever, and still grounded in the markdown truth.

## 2. Guiding Requirements

1. **Local-first**: Must run fully on a Windows laptop with no external API calls beyond the approved Qodo/MCP runtime.
2. **Dual-path storage**:
   - *Ephemeral context* → stored exactly as today (markdown only).
   - *Reusable concept* (flow, rule, data path, module summary, key parameter) → also registered in the structured atlas.
3. **Unified MCP server**: Remains a single MCP process that now exposes two logical modules: the existing document tools and the new atlas tools.
4. **Schema-backed**: Each structured entry has a type, name, summary, details, tags, related files, and doc path.
5. **Queryable**: Provide fast search (preferably SQLite FTS5) and retrieval capabilities for Qodo and future agents.
6. **Codebase awareness**: Support ingesting curated information extracted from the Java monolith (module summaries, data paths, key services).
7. **No proliferation**: Prevent random `.md` files by enforcing deterministic doc paths and update-in-place semantics via the new tools.

## 3. High-Level Solution Overview

```
                   ┌─────────────────────────┐
                   │    Qodo / MCP Client    │
                   └────────────┬────────────┘
                                │
           ┌────────────────────┴────────────────────┐
           │        Memory Bank MCP Server           │
           │ (single process, two logical modules)   │
           └────────────────────┬────────────────────┘
                                │
           ┌────────────────────┴────────────────────┐
           │                                         │
┌──────────────────────┐                 ┌────────────────────────┐
│ Document Store Tools │                 │  Structured Atlas Tools│
│ (existing behavior)  │                 │ (new create/search/get)│
└─────────┬────────────┘                 └──────────┬─────────────┘
          │                                         │
┌─────────▼──────────┐                     ┌────────▼────────────┐
│ File System        │<────────────────────│ SQLite Atlas DB     │
│ mem/flows/... .md  │    doc_path pointer │ (FTS5 + metadata)   │
└─────────┬──────────┘                     └────────┬────────────┘
          │                                         │
          └──────────────┬──────────────────────────┘
                         │
            ┌─────────────▼──────────────┐
            │ Index & Sync Coordinator   │
            │ - Keeps DB ↔ Markdown pair │
            │ - Runs code atlas builder  │
            └────────────────────────────┘
```

The atlas layer augments (not replaces) the markdown bank. Structured entries are still stored as markdown, but now have a canonical metadata row that enables fast lookup, linking, and governance.

## 4. Component Breakdown

### 4.1 Document Store (Existing)
- Holds every `.md` file and remains the source of truth.
- Directory pattern (configurable via `MEMORY_BANK_ROOT`):
  - `mem/flows/<flow>.md`
  - `mem/rules/<rule>.md`
  - `mem/data_paths/<path>.md`
  - `mem/module_summaries/<module>.md`
- Unstructured dumps keep the same ad-hoc layout.

### 4.2 Structured Atlas Database
- **Engine**: SQLite 3 with FTS5 (ships with Windows, no external dependency).
- **Files**:
  - `atlas/index.db` – metadata + FTS tables.
  - `atlas/db.lock` – lock file to coordinate concurrent access when multiple MCP clients are running.
- **Rationale**: SQLite FTS handles fuzzy search, phrase matching, boolean queries, and is trivial to bundle. For future experiments, a second table can store vector embeddings, but the baseline is pure FTS.

### 4.3 Atlas Coordinator
- New service object in the Node.js server responsible for:
  - Upserting rows in SQLite when `create_memory_item` is called.
  - Resolving doc paths and delegating writes to the existing file repository.
 - Maintaining referential integrity (row deleted when file removed).
  - Running consistency sweeps (`atlas sync`) that scan `mem/**` and ensure matching DB records.

### 4.4 Code Atlas Builder
- Offline command (Node script) that programmatically builds the structured data used by the atlas. The scan is not a blind "read files" loop; it executes a deterministic pipeline:
  1. **File discovery** – use `glob` patterns (configured via `atlas.config.json`) to enumerate Java, XML/XSL, SQL, and configuration files relevant to business logic.
  2. **AST & metadata extraction** – leverage parser tooling (Tree-sitter, JavaParser CLI, or ANTLR grammars) to generate abstract syntax trees. For XML/XSL, use an XML DOM parser. Persist the raw parser output to `atlas/runs/<ts>/raw/<relative-path>.json` for auditability.
  3. **Heuristic tagging** – run detectors that recognize:
     - Controller/service entry points (naming conventions, annotations like `@Service`, `@Transactional`).
     - Decision-heavy methods (nested `if/else`, switch statements, threshold comparisons) marked as candidate **Rules**.
     - Method chains or workflow orchestrations (sequences of service calls) marked as candidate **Flows**.
     - Data transfer object definitions, SQL queries, or XML templates marked as **Data Paths**.
  4. **Semantic summarization** – for each candidate, feed the AST slice + relevant comments into a local summarizer (Sonnet/GPT via Qodo) to produce human-readable summaries and detail sections that match the JSON contract in §5.2.
  5. **Normalization** – map each candidate to a normalized JSON envelope (`atlas/runs/<ts>/normalized/<uuid>.json`) containing type/name/summary/details/tags/related files/code location.
  6. **Doc synthesis + indexing** – call `atlas_create_memory_item` with the normalized payload. The controller writes the markdown file (via existing filesystem repositories) and upserts the SQLite row, which in turn updates the FTS index.
- Run manually or scheduled as a Windows Task when the repo changes. Re-using the stored raw/normalized JSON lets subsequent incremental scans diff against the previous run to avoid reprocessing unchanged files.

**Configuration (`atlas.config.json`)**
```json
{
  "codebaseRoot": "C:/projects/monolith",
  "include": ["src/main/java/**/*.java", "src/main/resources/**/*.xsl"],
  "exclude": ["**/test/**", "**/generated/**"],
  "flowDetectors": ["serviceControllers", "batchJobs"],
 "ruleDetectors": ["thresholdChecks", "eligibilityServices"],
 "dataPathDetectors": ["dtoDefinitions", "xmlTransforms", "sqlQueries"]
}
```
- The builder reads this file to know which detectors to run and where to persist intermediate artifacts. Each detector is a pluggable module so teams can add domain-specific heuristics without touching the core pipeline.

### 4.5 MCP Tools (New Module)
- Registered alongside current tools during server bootstrap.
- Exposed names (subject to MCP naming rules):
  - `atlas_create_memory_item`
 - `atlas_search_memory_items`
  - `atlas_get_memory_item`
  - `atlas_sync_index` (optional utility to rescan markdown & rebuild the DB).
- Each tool returns JSON payloads only; clients can follow the embedded `doc_path` to call the existing read tool if they need raw text.

### 4.6 Qodo Workflow Integration
- Qodo emits a JSON payload whenever the user labels something as reusable.
- MCP client logic follows the "mental rule":
  - "Raw once-off context" → call `memory_bank_write` only.
  - "Reusable flow/rule/data path/module summary" → call `atlas_create_memory_item`.
- When Qodo searches, it can call `atlas_search_memory_items` first to discover canonical entries, then optionally fetch the markdown for detail.

### 4.7 Build-From-Scratch Checklist

1. **Environment setup**
   - Set `MEMORY_BANK_ROOT` to the Windows-safe folder that will store both markdown docs and the atlas DB (e.g., `C:\memory-bank`).
   - Optionally set `ATLAS_DB_PATH` if the SQLite file should live outside the default `atlas/index.db`.
2. **Install dependencies**
   - Run `npm install sqlite3 better-sqlite3 uuid slugify gray-matter proper-lockfile` to satisfy atlas-specific storage and parsing needs.
3. **Directory layout**
   - Under `MEMORY_BANK_ROOT`, create:
     - `mem/flows`, `mem/rules`, `mem/data_paths`, `mem/module_summaries`
     - `atlas/` (contains `index.db`, `runs/`, `migrations/`)
4. **Database initialization**
   - Place the SQL from §5.1 into `atlas/migrations/001-init.sql`.
   - Implement a migration runner (`AtlasMigrationService`) that executes SQL files during server boot or via `npm run atlas:init`.
5. **Code changes**
   1. Build `SQLiteAtlasRepository` (in `src/infra/database`) to encapsulate DB connections, migrations, FTS synchronization, and locking.
   2. Build `AtlasService` (in `src/data/services/atlas`) with methods `upsertItem`, `searchItems`, `getItemById`, and `syncFromMarkdown`.
   3. Create new controllers + validators under `src/presentation/controllers/atlas` mirroring existing patterns.
   4. Register the controllers in `src/main/index.ts` so the MCP server advertises the new tools.
6. **CLI wiring**
   - Add scripts to `package.json`:
     - `atlas:init` → run migrations + sanity checks.
     - `atlas:scan` → execute the code atlas builder (see §4.4).
     - `atlas:sync` → reconcile markdown/DB mismatches and support manual refresh or incremental updates.
7. **Documentation & instructions**
   - Copy workflow snippets (Section 12) into `custom-instructions.md`.
   - Document tool inputs/outputs in `docs/API_Documentation.md` so MCP clients can integrate without guesswork.
8. **Testing**
   - Unit-test slugification, doc path derivation, and DB read/write invariants.
   - Integration-test `atlas_*` MCP tools using a temp directory for `MEMORY_BANK_ROOT`.

This checklist removes ambiguity for newcomers: follow the steps sequentially to stand up the atlas layer from scratch.

### 4.8 Integration with Existing Memory Bank MCP Tools

The atlas layer sits beside the current MCP server functionality; we do **not** replace the document store. Instead:

- **Knowledge source**: All canonical content lives on disk under `MEMORY_BANK_ROOT`. The existing MCP APIs remain the way Qodo and humans read/write those files.
- **Primary tools already shipped in this repo**:

| Tool | Purpose | Typical Flow Step |
|------|---------|-------------------|
| `list_projects` | Enumerate available project roots inside `MEMORY_BANK_ROOT`. | Qodo uses before requesting specific documents. |
| `list_project_files` | List files underneath a given project folder. | Used when the agent wants raw markdown outside the atlas. |
| `memory_bank_read` | Fetches the contents of an existing document. | Both atlas workflows and normal usage rely on this to display `doc_path` entries. |
| `memory_bank_write` | Creates a brand-new document (normally `.md`). | Used for ephemeral context dumps that should stay outside the atlas. |
| `memory_bank_update` | Replaces entire file contents. | Called when humans edit markdown manually or after atlas upsert writes the generated markdown. |
| `append_file` / `log_file` tools | Existing helpers for incremental logging and versioning. | Optional for capturing investigation transcripts that do not qualify for atlas entries yet. |

**Integration expectations**
1. When `atlas_create_memory_item` writes or updates a document, it still goes through `FsFileRepository`, which ultimately uses the same file-system logic exercised by `memory_bank_write/update`. We simply orchestrate the call via the Atlas Service.
2. Qodo instructions must explicitly mention the base tools:
   - To read a `doc_path` returned by the atlas search, call `memory_bank_read`.
   - To check sibling files or supporting notes, use `list_project_files`.
3. The document store therefore remains a full knowledge source: all other engineering artifacts (runbooks, architecture notes, JSON configs) still live as plain files. The atlas only enriches a *subset* of documents with structured metadata.
4. Existing automation (e.g., `validate_apis.js`, tests) remain valid; the atlas never bypasses their logic.

This tight integration guarantees we can adopt the atlas without rewriting the host MCP server or breaking workflows already in use.

### 4.9 Simulated Index Build (Complex Java Scenario)

*This scenario is illustrative, inspired by the model-portfolio rebalance flows described in the business context above. It demonstrates how the atlas—running inside this MCP server—handles intertwined Java code; it is not a description of specific files currently in the repo.*

Atlas always runs as part of this MCP server. The `atlas:scan` CLI simply orchestrates the same Node process (with access to the filesystem repositories already used by `memory_bank_*` tools) and produces structured artifacts that later become markdown via MCP APIs.

**Scenario**

- `PortfolioFlow` interface defines `processRebalance()` and `processCashRaise()`.
- Implementations:
  - `InstitutionalPortfolioFlow` (handles institutional models, ETF drift thresholds, and tax-aware sleeves).
  - `RetailPortfolioFlow` (handles retail clients with simplified suitability rules).
- Each class has helper methods (`rebalanceLargeCapSleeve`, `applyTradeRestrictions`) that belong to distinct flows/rules.

**How the builder handles it**

1. **AST discovery**
   - The parser identifies `PortfolioFlow` as an interface and records its methods.
   - When scanning implementations, it notes `implements PortfolioFlow`.
   - Relationship metadata is written to `atlas/runs/<ts>/raw/com/acme/portfolio/InstitutionalPortfolioFlow.json` (includes method signatures, annotations).

2. **Flow segmentation**
   - Detector module `serviceControllers` inspects each public method. For `processRebalance`, it detects sequential steps (load holdings, evaluate drift, generate trades, send FIX messages).
   - For helper methods, detectors classify them separately (e.g., `applyTradeRestrictions` flagged as a **Rule** because it enforces compliance thresholds).

3. **Implementation differentiation**
   - When multiple classes implement the same interface, the normalized JSON includes `interface: PortfolioFlow` and `implementation: InstitutionalPortfolioFlow`. Tags such as `flow:processRebalance` + `context:institutional` get attached so searches can differentiate the flows.
   - If a method overrides another, the builder links them via `relatedFiles` referencing both the interface and the concrete class.

4. **Semantic summary via Qodo**
   - For each detected flow/rule, the builder extracts the relevant AST slice and feed text into Qodo (Sonnet/GPT) using prompts like:
     ```
     Summarize the business logic of method com.acme.portfolio.InstitutionalPortfolioFlow#processRebalance.
     Highlight conditions, branches, data paths, and downstream services.
     ```
   - The returned summary and detail sections fill the JSON envelope (`name`, `summary`, `details`).

5. **Markdown + SQLite update**
   - The normalized payload looks like:
     ```json
     {
       "type": "flow",
       "name": "Institutional Portfolio Rebalance Flow",
       "summary": "Handles ETF/MF model rebalancing when drift exceeds configured thresholds, respecting tax and restriction rules.",
       "details": "1. Load holdings...\n2. If sleeve drift > 5%...\n",
       "tags": ["flow:processRebalance", "interface:PortfolioFlow", "impl:InstitutionalPortfolioFlow"],
       "relatedFiles": [
         "src/com/acme/portfolio/PortfolioFlow.java#L10-L40",
         "src/com/acme/portfolio/InstitutionalPortfolioFlow.java#L45-L210"
       ],
       "codeLocation": "com.acme.portfolio.InstitutionalPortfolioFlow#processRebalance",
       "source": "code-index"
     }
     ```
   - `atlas_create_memory_item` writes `mem/flows/flow__institutional_portfolio_rebalance.md` with the YAML front matter shown earlier and upserts the SQLite record so FTS can index the text.

6. **Cross-file linkage**
   - If a helper method's logic spans multiple classes (e.g., `TradeRestrictionService`), the builder adds that file to `relatedFiles` and, if necessary, generates a separate **Rule** entry so the knowledge is reusable.

Through this flow, atlas builds data by combining parser output, heuristic detectors, and Qodo-generated summaries before any markdown exists. Markdown is the *result* of the process (written via MCP APIs), not the input. For ad-hoc investigations where humans manually craft markdown/JSON, the atlas sync job simply reads those files, parses the front matter, and pushes them into SQLite using the same schema—everything stays grounded in the shared MCP server.

### 4.10 Additional Enhancements for Deep Java/EJB Stacks

To make the atlas truly generic (beyond the wealth-management exemplar), plan for these capabilities during implementation:

1. **Static call-graph + package map**
   - Use tools like `jdeps`, `ClassGraph`, or Spoon to generate lightweight call graphs per module.
   - Attach upstream/downstream caller info to atlas entries so agents see how UI events traverse services, EJBs, and DAOs.

2. **Annotation-driven detectors**
   - Extend scanners to parse annotations/config (`@Stateless`, `@EJB`, `@Transactional`, XML descriptors).
   - Auto-tag flows/rules with transaction boundaries, security roles, and bean injection points—critical clues in EJB/OOP-heavy code.

3. **Domain entity registry**
   - Maintain a JSON/YAML listing of core business entities (Account, ModelPortfolio, TradeTicket, etc.).
   - Link atlas entries, Java packages, and database tables to those entities for easier navigation across layers.

4. **Javadoc/comment harvesting**
   - Pull existing Javadoc + inline comments into normalized JSON so curated intent survives even before human editing.

5. **Interface-implementation matrix**
   - Auto-produce tables showing each interface (including EJB local/remote interfaces) and its concrete implementations with links to atlas docs.

6. **Diagram artifacts**
   - Encourage agents to render Mermaid/UML sequence diagrams per flow, store them via `memory_bank_write`, and reference them from atlas entries.

7. **Vector search (optional)**
   - Keep SQLite/FTS as the primary index. Consider adding embeddings (sqlite-vec, pgvector, or a local vector DB) only after deterministic search hits limits—e.g., when semantic similarity across differently worded flows becomes critical.
   - If added, store vectors alongside existing metadata so the MCP tooling remains unchanged for clients that only need keyword search.

## 5. Data Model & Schema

### 5.1 Core Tables

```sql
CREATE TABLE IF NOT EXISTS memory_items (
    id              TEXT PRIMARY KEY,            -- UUID v7 recommended
    type            TEXT NOT NULL,               -- flow | rule | data_path | module_summary | custom
    name            TEXT NOT NULL,
    summary         TEXT NOT NULL,
    details         TEXT NOT NULL,               -- cached snippet for quick previews
    tags            TEXT NOT NULL DEFAULT '[]',  -- JSON array stored as TEXT
    doc_path        TEXT NOT NULL,               -- relative path under MEMORY_BANK_ROOT
    related_files   TEXT NOT NULL DEFAULT '[]',  -- JSON array of repo file paths
    created_by      TEXT NOT NULL,
    updated_by      TEXT NOT NULL,
    created_at      INTEGER NOT NULL,            -- epoch millis
    updated_at      INTEGER NOT NULL,
    source          TEXT NOT NULL,               -- manual | qodo | code-index | migration | other
    code_location   TEXT                         -- optional canonical Java package / file path
);

CREATE VIRTUAL TABLE IF NOT EXISTS memory_items_fts
USING fts5(
    name,
    summary,
    tags,
    details,
    content='memory_items',
    content_rowid='rowid'
);
```

Synchronization triggers keep the FTS table aligned with the base table.

### 5.2 JSON Contract for Qodo / Model

```json
{
  "type": "flow | rule | data_path | module_summary | custom",
 "name": "ETF drift rebalance flow",
  "summary": "Describes how advisors rebalance a model when ETF drift exceeds thresholds",
 "details": "Step-by-step narrative or enumerated logic (load holdings, evaluate drift, raise cash, trade)",
  "tags": ["rebalance", "portfolio", "drift", "java:InstitutionalPortfolioFlow"],
  "relatedFiles": [
    "src/com/acme/portfolio/InstitutionalPortfolioFlow.java#L120",
    "resources/templates/trade_generation.xsl"
 ],
  "source": "qodo",
  "codeLocation": "com.acme.portfolio.InstitutionalPortfolioFlow",
  "docPathOverride": "mem/flows/etf_drift_rebalance.md" // optional
}
```

Server behavior:
- Generates `id` if omitted.
- If `docPathOverride` absent, builds one via slugified name + type (e.g., `mem/flows/flow__etf_drift_rebalance.md`).
- Writes markdown body that combines summary, details, references, and metadata front-matter (YAML or JSON block) so humans can read/edit outside MCP.
- Upserts SQLite row referencing that file.

### 5.3 Markdown Template

```markdown
---
id: 3c7d0e25-9abf-4d2a-9c9b-2f8f9f8f1a52
type: flow
name: ETF drift rebalance flow
tags:
  - portfolio
  - drift
related_files:
  - src/com/acme/.../InstitutionalPortfolioFlow.java#L120
source: qodo
last_synced: 2024-05-14T10:15:00Z
---

## Summary
<summary>

## Details
<details>

## Key Data Paths
- `<path>`
```

Markdown remains editable; the sync job parses the front-matter to push changes back into SQLite.

### 5.4 Canonical Meanings (Flow, Rule, Data Path, Module Summary)

- **Flow**  
  - Represents a multi-step business journey (e.g., "Model Portfolio Drift Rebalance").  
 - Captures logical sequences such as "If ETF sleeve drift ≥ 5% AND tax lot is long-term THEN raise cash via ETF trades; else trigger advisor review".  
 - Include: triggers, decision points, branching logic, participating services, and resulting outcomes.  
  - Use flows whenever Qodo uncovers an if/else narrative that spans multiple modules or impacts user experience.

- **Rule** 
  - Atomic eligibility or calculation constraint (e.g., "Trigger rebalance when asset drift exceeds 5% or position value > $250k").  
  - Structure: condition(s), action/result, exceptions, linked regulatory references.  
  - Often embedded inside flows but stored separately to enable reuse across flows.

- **Data Path**  
  - Describes how critical data moves through the system: DB tables → DTOs → services → templates. 
  - Document the schema snippet, key fields, transformations, and downstream consumers.  
  - Use when reverse-engineering "where does field X originate?" or "who mutates flag Y?".

- **Module Summary**  
  - High-level overview of a subsystem or package (e.g., "BillingAdjustments module handles waiver, surcharge, refund flows").  
  - Include responsibilities, exposed APIs, entry points, and relationships to relevant flows/rules/data paths.

**Instruction for coding agents**: Whenever you parse logic such as "if condition A and condition B then call ServiceX else call ServiceY," treat it as part of a Flow entry. If the logic is a reusable gating rule, capture it separately as a Rule and link it via tags/related files. This ensures the atlas preserves both the narrative and the precise conditions.

### 5.5 File Type Guidance for Agents

| Scenario | File Type | Storage Path | Tooling |
|----------|-----------|--------------|---------|
| Ephemeral investigation notes, debugging transcripts, daily logs. | Markdown (`.md`) with no front matter required. | `mem/scratch/<date>-<topic>.md` (or similar). | `memory_bank_write` / `memory_bank_update`. |
| Structured flows/rules/data paths/module summaries. | Markdown with YAML front matter (template in §5.3). | Deterministic path such as `mem/flows/<slug>.md`. | `atlas_create_memory_item` (writes markdown then updates SQLite). |
| Metadata-only helpers (e.g., JSON configuration for tooling, table definitions exported from DB). | JSON (`.json`) when raw machine-readable data is needed. | `mem/data_specs/<name>.json`. Reference from markdown via `related_files`. | `memory_bank_write` / `memory_bank_update`. |
| Atlas metadata persisted in DB. | SQLite row (no standalone file). | `atlas/index.db`. | Access via `atlas_*` tools only. |

**Agent instruction**: Do not invent new file types. If you must save structured data for automation (e.g., an object schema), write it as JSON under the document store and then reference that JSON file from the relevant atlas entry (tags + `related_files`). The markdown remains the authoritative narrative; JSON/other files serve as supporting assets.

## 6. Key Workflows

### 6.1 Manual Codex/Qodo Workflow (Investment Buy Flow Example)

**Scenario**: You are analyzing the "Investment Buy Flow" (15+ steps involving suitability checks, order enrichment, FIX routing, settlement). You want Qodo (Sonnet 4.5) to parse the code, write detailed markdown in the existing project memory bank, and ensure the atlas indexes it for future retrieval.

1. **Read existing context**  
   - Qodo calls `memory_bank_read` against any previously known files (e.g., `mem/flows/investment_buy_overview.md`).
   - If nothing exists, create a scratch document via `memory_bank_write` to capture raw notes (this stays outside the atlas).

2. **Parse the flow**  
   - Prompt Qodo: "Walk through `InvestmentBuyController`, `SuitabilityService`, `OrderEnrichmentService`, and `FixRouter`. Produce a structured summary with 15 steps, decision points, and data paths."  
   - Qodo reads the Java files (outside this MCP) but stores its curated findings via the MCP tools.

3. **Author atlas-ready markdown** 
   - Qodo prepares a JSON payload (per §5.2) for `atlas_create_memory_item`:
     ```json
     {
       "type": "flow",
       "name": "Investment buy flow",
       "summary": "15-step advisor workflow covering suitability, funding, order enrichment, and settlement.",
       "details": "1. Advisor selects account...\n2. SuitabilityService validates exposure...\n3. …",
       "tags": ["trade", "buyFlow", "suitability", "fixRouting"],
       "relatedFiles": [
         "src/com/acme/trading/InvestmentBuyController.java#L1-L200",
         "src/com/acme/compliance/SuitabilityService.java#L10-L180",
         "src/com/acme/order/OrderEnrichmentService.java#L1-L220",
         "src/com/acme/fix/FixRouter.java#L30-L190"
       ],
       "source": "qodo",
       "codeLocation": "com.acme.trading.InvestmentBuyController#execute"
     }
     ```
   - Qodo calls `atlas_create_memory_item` with this payload. The server:
     - Validates inputs.
     - Writes `mem/flows/investment_buy_flow.md` with YAML front matter + Summary/Details sections.
     - Upserts the corresponding row in SQLite/FTS.

4. **Add supporting assets**  
   - If there are JSON schemas, FIX message samples, or diagrams, Qodo stores them using `memory_bank_write` (e.g., `mem/data_specs/fix_buy_template.json`) and references them in the flow's `related_files`.

5. **Verification**  
   - Qodo immediately calls `atlas_get_memory_item` (or `memory_bank_read`) to confirm the markdown exists.
   - Optionally run `atlas_search_memory_items` with `query = "investment buy"` to ensure the FTS index surfaces it.

6. **Future use**  
   - A week later, when you ask "How does the investment buy flow handle suitability?", Qodo first executes `atlas_search_memory_items query="investment buy suitability"`. The returned metadata includes the newly created `doc_path`, enabling instant recall. Qodo can then read the markdown for specifics, without reparsing the entire codebase.

This workflow demonstrates that **manual, Qodo-authored content** (via the existing MCP file tools) becomes part of the atlas simply by invoking `atlas_create_memory_item`. No separate indexing pass is required—the create/update operation itself writes markdown and updates SQLite, ensuring long-term discoverability.

### 6.2 Create / Update Structured Memory (API View)
1. Client sends payload to `atlas_create_memory_item`.
2. Controller validates schema (type, name, summary, etc.), slugifies doc path, and locks the SQLite DB.
3. Coordinator writes/updates the markdown file via the existing repositories (so ACL/path safety logic is reused).
4. Coordinator upserts `memory_items` and refreshes FTS row.
5. Response returns metadata plus `doc_path` so clients can open it.

### 6.3 Search Structured Memory
1. Client calls `atlas_search_memory_items` with parameters:
   - `query` (FTS expression)
   - `filterTypes` (array of allowed types)
   - `limit` (default 20)
2. Controller runs a parameterized FTS query:

```sql
SELECT json_object(
    'id', id,
    'type', type,
    'name', name,
    'summary', summary,
    'tags', tags,
    'docPath', doc_path
)
FROM memory_items_fts
JOIN memory_items ON memory_items.rowid = memory_items_fts.rowid
WHERE memory_items_fts MATCH :query
  AND (:typesFilter IS NULL OR type IN (:typesFilter))
ORDER BY bm25(memory_items_fts)
LIMIT :limit;
```

3. Client may follow up with `atlas_get_memory_item` or `memory_bank_read` for full markdown.

### 6.4 Retrieve Item
- `atlas_get_memory_item` accepts `id` or `doc_path`.
- Reads metadata from SQLite and the markdown body from disk.
- Returns both so Qodo can show context inline.

### 6.5 Atlas Sync
- `atlas_sync_index` is an optional maintenance tool.
- Steps:
  1. Walk `mem/**/*`.
  2. Parse front-matter; if `id` missing, assign one and update file.
  3. Upsert into SQLite; delete rows for missing files.
  4. Rebuild FTS table for integrity.
- Run manually when migrating existing notes or when editing markdown outside MCP.

### 6.6 Large Codebase Indexing
- **Inputs**: `codebase_root`, include/exclude globs, mapping config for known module boundaries.
- **Process**:
  1. `atlas code-scan` CLI executes static analyzers (ctags, JavaParser, custom heuristics) to collect:
     - Service endpoints and associated flows.
     - Eligibility rules (if/else chains referencing flags).
     - Data paths (database tables, DTO fields, XML/XSL transforms).
     - Module dependencies.
  2. Emits JSON envelopes (per §5.2) with `source: "code-index"` and `codeLocation` set.
 3. Calls `atlas_create_memory_item` for each envelope (batch mode).
  4. Optionally deduplicates by slugified name to avoid duplicates.
- **Outputs**: Markdown entries referencing actual code locations, making Qodo aware of canonical flows without re-crawling the monolith each session.

## 7. MCP Tool Signatures

| Tool | Parameters | Response |
|------|------------|----------|
| `atlas_create_memory_item` | `payload` (JSON described in §5.2). Optional `mergeStrategy` (`overwrite`, `append_sections`, `manual`). | `{ "id": "...", "docPath": "mem/flows/...", "type": "...", "summary": "...", "tags": [...], "createdAt": 123, "updatedAt": 123 }` |
| `atlas_search_memory_items` | `query` (string), `filterTypes` (string[]), `tags` (string[], AND semantics), `limit` (number), `includeScores` (bool) | `{ "items": [ { "id": "...", "name": "...", "summary": "...", "tags": [...], "docPath": "..." , "score": 0.12 } ] }` |
| `atlas_get_memory_item` | `id` or `docPath`, optional `includeMarkdown` flag (default true). | `{ "item": { ... metadata ... }, "markdown": "..." }` |
| `atlas_sync_index` | `mode` = `scan_all` (default) or `rebuild_fts` | `{ "synced": 124, "skipped": 12, "deleted": 3 }` |

All tools reuse the server's validation infrastructure (composite validators, path safety).

## 8. Operational Considerations

- **File Locking**: Use SQLite's WAL mode plus a lightweight mutex (e.g., `proper-lockfile`) before writes to avoid concurrent corruption when multiple MCP clients are active.
- **Backups**: The atlas DB and markdown files live under the same root so Windows File History or simple zipped backups capture both.
- **Versioning**: `memory_items` table stores timestamps and `updated_by`; optionally add a history table or rely on git if the memory root is versioned.
- **Performance**: FTS queries over a few thousand rows complete in milliseconds. For very large sets, add indexes on `type` and `code_location`.
- **Security**: Reuse existing validators to ensure doc paths never escape `MEMORY_BANK_ROOT`. SQLite file sits adjacent to mem root but inherits OS permissions.
- **Extensibility**: Future vector support can be layered by adding `memory_item_embeddings (id TEXT PRIMARY KEY, vector BLOB)` and hooking into the same create/update pipeline.

## 9. Usage Playbook (Mental Rule)

1. **Ephemeral note** (single-session debugging, scratchpad) → `memory_bank_write` as today.
2. **Reusable artifact** (flow, rule, data path, module summary, known flag, curated module relationships) → `atlas_create_memory_item`.
3. Searching for prior knowledge:
   - Try `atlas_search_memory_items` first.
   - If nothing found, fall back to folder search or re-explore and then save via the atlas path.

This keeps the document store small and ensures the atlas remains the canonical "business knowledge graph" for the monolith.

## 10. Implementation Roadmap

1. **Foundations**
   - Add SQLite dependency and lightweight repository inside `src/infra/database`.
   - Introduce atlas service + controllers + MCP tool registrations.
2. **Schema & Migration**
   - Ship SQL migration script to create tables/FTS/triggers.
   - Provide CLI `npm run atlas:init` to bootstrap DB under the configured memory root.
3. **Markdown Template Support**
   - Extend write/update use cases to accept `frontMatter` blocks.
   - Document template in `docs/README.md`.
4. **Code Atlas Builder**
   - Create CLI `npm run atlas:scan -- --root <path>`.
   - Start with heuristics (ctags + regex) before introducing heavier parsers.
5. **MCP Instruction Updates**
   - Update `custom-instructions.md` so Qodo knows when to hit atlas tools.
   - Provide example prompts referencing the JSON payload.

Once complete, the team gains a persistent, queryable knowledge atlas without abandoning the existing document workflow.

## 11. Re-Indexing Strategy for a Moving Target

- **Reality**: 50+ developers commit daily, so both Java source and markdown notes drift constantly. The atlas must therefore support structured re-indexing loops that Qodo (running Sonnet 4.5 or GPT‑5) can reliably execute. Below is the detailed procedure for each pillar, including checkpointing guidance to survive model hangs or restarts.

### 11.1 Full Initial Sweep

1. **Preparation**
   - Freeze other atlas mutations (pause create/update calls) so the baseline run sees a stable file tree.
   - Create a working directory under `atlas/runs/<timestamp>/` containing:
     - `scan.log` – append-only for progress messages.
     - `state.json` – checkpoint file (see below).
2. **Kick-off via Qodo**
   - Prompt template:
     ```
     You are executing the initial atlas index. Run `npm run atlas:scan -- --root <repo> --checkpoint atlas/runs/<ts>/state.json --full`.
     After each batch of 100 files, write progress via `atlas:scan --status`.
     ```
   - Ensure Qodo streams command output back so you can monitor.
   - Confirm the scan picked up `atlas.config.json`; the first log lines should echo the include/exclude patterns and detector modules.
3. **Checkpointing**
   - The scan script writes JSON such as:
     ```json
     {
       "mode": "full",
       "lastProcessedPath": "src/com/acme/foo/BarService.java",
       "processedFiles": 320,
       "createdItems": 45,
       "updatedItems": 12,
       "startedAt": "2024-05-20T09:0:00Z"
     }
     ```
   - The CLI accepts `--resume` (default if `state.json` exists). When Qodo hangs, relaunch the agent and rerun the same command; it will skip files already recorded.
4. **Output**
   - At completion, persist a summary blob with file counts, item counts, elapsed time, and git commit hash so future runs know the baseline.
   - Verify that `atlas/runs/<ts>/raw` (parser dumps) and `atlas/runs/<ts>/normalized` (JSON envelopes) contain artifacts—you can replay them later instead of re-reading source files if only markdown generation failed.

### 1.2 Incremental Updates

1. **Trigger frequency**
   - Use Windows Task Scheduler or a git hook to invoke `npm run atlas:scan --incremental --since <lastSha>` every few hours.
   - Qodo prompt: "Run incremental atlas scan since `${LAST_SHA}`. If the tool exits prematurely, rerun with `--resume`."
2. **Changed-file discovery**
   - CLI queries `git diff --name-only <lastSha> HEAD` and stores the list inside the checkpoint under `pendingFiles`.
   - For each file, check if a prior raw JSON snapshot exists under `atlas/runs/<lastFullScan>/raw`. If it does, diff the AST JSON to avoid re-parsing unchanged portions.
3. **Checkpoint schema**
   ```json
   {
     "mode": "incremental",
     "lastSha": "abc123",
     "pendingFiles": ["src/com/acme/foo/Bar.java", "..."],
     "processedFiles": 18,
     "createdItems": 4,
     "updatedItems": 9,
     "skippedFiles": 2
   }
   ```
   - On restart, the scanner pops from `pendingFiles` until empty.
4. **Atlas writes**
   - Each parsed artifact emits `source: "code-index"`, `code_revision: <HEAD sha>`, and reuses stable IDs so updates remain idempotent.

### 11.2.1 Diff Mapping & Multi-Flow Updates

Incremental diffs often touch multiple flows/rules in a single commit. The update pipeline therefore needs to batch related changes while keeping them traceable.

1. **Collect git metadata**
   - For each changed file, call `git log -1 --stat <file>` to capture the commit message, author, and touched sections. Store this metadata alongside the checkpoint so Qodo can reference it in summaries.
2. **Slice diffs by logical block**
   - Use `git diff --unified=0 -- <file>` to extract exact line ranges.
   - Feed the diff chunks to the analyzer, which classifies them as:
     - `flow_mutation` (affects control logic)
     - `rule_mutation` (changes predicates)
     - `data_path_mutation` (altered schema/DTO)
   - Each chunk carries `{file, startLine, endLine, classification}` in the checkpoint.
3. **Map to atlas entries**
   - Query SQLite for items whose `related_files` intersect the file path and line range. If multiple flows exist in one file, match by tags (e.g., method names) stored in metadata.
   - If no existing entry matches, mark the chunk as `requires_new_entry`.
4. **Update sequence per chunk**
   - Read the current markdown (`atlas_get_memory_item`).
   - Invoke Qodo prompt:
     ```
     Update the flow description to reflect the following diff:
     <diff snippet>
     Preserve existing sections; append new steps or modify conditions.
     ```
   - After editing, call `atlas_create_memory_item` with the same ID (upsert) so the DB stays in sync.
5. **Capturing unrelated flows**
   - When one commit touches unconnected flows, process each chunk independently: the checkpoint's `pendingChunks` array keeps them separate so a crash only replays the remaining portions.
   - Each chunk records `linkedAtlasIds` so we know which entries were already updated when resuming.
6. **Audit trail**
   - Append a note to the markdown front matter (`last_diff_ref: <commitSha>:<file>:<lines>`) so future maintainers can trace why an entry changed. Use a list if multiple commits affect the same flow.
   - Optionally stash the updated normalized JSON under `atlas/runs/<ts>/normalized` so future scans can compare semantic deltas without re-deriving summaries.

### 11.3 Manual Refresh

1. **Use case**
   - An analyst edits `mem/flows/etf_drift_rebalance.md` manually or discovers drift between markdown and code.
2. **Command structure**
   - `npm run atlas:sync -- --doc mem/flows/etf_drift_rebalance.md --checkpoint atlas/runs/manual/state.json`.
   - The job only touches the specified doc but still writes progress to `state.json` (with `mode: "single"`), so repeated runs don't duplicate work.
3. **Qodo prompt**
   ```
   When the user asks to refresh a single flow, call the sync command above, wait for completion, report `synced/updated` counts, and, if interrupted, rerun with `--resume`.
   ```

### 11.4 Version Tagging

1. **During each scan**
   - Capture `git rev-parse HEAD` and store as `code_revision` in `memory_items`.
   - Append the SHA to the markdown front matter (`code_revision: abc123`).
2. **Usage**
   - Qodo instructions: "When showing an atlas entry, compare `code_revision` with the checked-out SHA. If they differ, mention that the item may be stale and propose a refresh."
3. **Checkpoint aid**
   - Record the SHA in `state.json`; on resume, verify the repo is still at the same commit. If not, halt and ask the user to rerun from scratch to avoid mixing revisions.

### 1.5 Monitoring & Reporting

1. **Metrics emitted per batch**
   - `filesProcessed`, `itemsCreated`, `itemsUpdated`, `durationMs`, `errors`.
   - Write to `scan.log` and optionally `atlas/runs/<ts>/metrics.csv`.
2. **Qodo behavior**
   - After each batch or every five minutes, instruct the agent to read the log tail and summarize progress to the user.
   - If the agent crashes, the next session can read `scan.log` + `state.json` to know where to resume.
3. **Alerting thresholds**
   - If `durationMs` per file exceeds a configured limit or error count spikes, Qodo should halt and request human attention rather than looping endlessly.

### 1.6 General Checkpointing Guidelines

- **File format**: JSON so it's human-inspectable and easy for Qodo to edit/append.
- **Atomic writes**: Write to `state.json.tmp`, then rename to avoid corruption if Qodo terminates mid-write.
- **Restart recipe**:
 1. Kill the stuck Qodo session.
  2. Relaunch Qodo (Sonnet 4.5 or GPT‑5) with the instruction "Resume atlas scan using checkpoint `<path>`."
 3. Ensure the CLI starts with `--resume` (implied when `state.json` exists).
  4. Watch for "Resumed from <lastProcessedPath>" in output before proceeding.
- **Multiple agents**: Allow only one long-running scan at a time. If a second agent needs to run, it should check for an existing checkpoint lock and wait/abort.

## 12. Instruction & Workflow Templates for Qodo

### 12.1 Core Instruction Snippets

1. **Atlas save rule**
   ```
   When you uncover a reusable flow/rule/data path/module summary, call `atlas_create_memory_item` with the canonical JSON payload. Do not spawn ad-hoc markdown files.
   ```
2. **Markdown structure**
   ```
   Every atlas-backed markdown file must use the front matter + Summary/Details/Key Data Paths layout described in docs/Structured_Memory_Atlas.md §5.3.
   ```
3. **Search discipline**
   ```
   Before re-deriving logic, call `atlas_search_memory_items` (query + filters). Only if nothing relevant is returned may you explore code afresh.
   ```
4. **Document store usage**
   ```
   All doc paths live in the existing Memory Bank MCP. Use `memory_bank_read`/`write`/`update` to access them; atlas tools only handle metadata + orchestration.
   ```

### 12.2 Daily Working Workflow (Agent Checklist)

1. Run `atlas_search_memory_items` for the task-relevant tags (module, feature, data path).
2. Open `doc_path` hits with `memory_bank_read` to refresh context.
3. Execute the coding task (use Qodo features as usual).
4. If new reusable knowledge emerges, craft the JSON payload (type/name/summary/details/tags/related files) and call `atlas_create_memory_item`.
5. Log scratch notes as plain markdown if they are session-only.

### 12.3 Dedicated "Logical Indexing" Workflow

Single instruction the agent can trigger when asked to map an entire logical area:

```
Goal: produce or update structured atlas entries for every flow/rule/data path in <module or domain>.
Steps:
  1. Load `atlas.config.json` to determine which detectors apply; adjust include/exclude patterns if the scope is limited (e.g., only billing modules).
 2. Run `atlas:scan -- --root <path> --detectors flow,rule,data` so the builder creates parser dumps under `atlas/runs/<ts>/raw`.
 3. Review the normalized JSON emitted in `atlas/runs/<ts>/normalized`; make edits if useful (e.g., add tags, tweak names) before committing them to the atlas.
  4. For each normalized payload, call `atlas_create_memory_item` (or update) with type=flow/rule/data_path as appropriate, referencing code paths in `relatedFiles`.
  5. Tag entries with release/version/ticket references if available.
  6. Repeat until coverage checklist is satisfied (100% of files in scope).
Output: clean atlas entries + markdown grounded in code so future questions reuse them instead of re-indexing.
```

### 12.4 Workflow Library

- Store the above instructions plus any new workflows in `docs/workflows/` and reference them from `custom-instructions.md`. This keeps Qodo prompts centralized and versioned alongside the server.

### 12.5 Update / Diff Handling Instructions

When Qodo receives a request to "update the atlas for latest changes," follow this playbook:

1. Run `npm run atlas:scan -- --incremental --since <lastSha> --checkpoint <path>` to generate the diff chunks described in §11.2.1.
2. For each chunk in `pendingChunks`:
   - Fetch the corresponding atlas entry (`atlas_get_memory_item id=<id>`). If none exists, create a new entry after analyzing the diff.
   - Rewrite only the affected sections (Summary, Details, Key Data Paths). Call out the new conditionals explicitly ("If flag X is set, now call ServiceY1; otherwise call ServiceY2").
   - Upsert via `atlas_create_memory_item` with the existing ID and add `last_diff_ref` metadata referencing `<commitSha>:<file>:<start>-<end>`.
3. Update checkpoint progress to record the chunk as processed before moving to the next one, so an interruption restarts from the remaining slices rather than repeating finished work.
4. Once all chunks are processed, run `atlas:scan --status` and write the resulting summary to `scan.log`. Include counts of flows/rules/data paths updated so humans can audit the change.

## 13. Storage Technology Evaluation (SQLite FTS vs Vector/RAG)

| Option | Pros | Cons | Fit |
|--------|------|------|-----|
| **SQLite + FTS5 (baseline)** | Ships with Node/Windows; trivial deployment; strong keyword/phrase search; transactional; no network dependency; easy to back up with markdown. | Limited semantic search; requires manual synonym/tag curation; large-scale analytics need batching. | Ideal for deterministic lookups when we know the vocabulary (flows, rules, data paths). Keeps architecture simple and fully local. |
| **SQLite with `sqlite-vec` or `pgvector`** | Embeddings stored alongside metadata; can support approximate semantic search without separate service; still single-file deployment. | Requires generating embeddings (needs local model); increases storage and CPU; still limited to vector cosine similarity (no hybrid ranking). | Viable future enhancement once we want "find flows similar to X" without keyword overlap. |
| **Local vector DB (Chroma, LanceDB, Milvus-lite)** | Optimized for high-dimensional vectors; hybrid search capabilities; plug-and-play ingestion pipelines. | Adds dependency (Python or Go services); may require background server; heavier resource usage; more operational overhead on Windows laptops. | Consider only when semantic recall becomes the bottleneck and the team is comfortable running an extra service. |
| **RAG stack (e.g., LlamaIndex + vector store + retriever)** | Provides orchestration for chunking, indexing, and retrieval; integrates with many models. | Pulls in more tooling than needed; may conflict with enterprise restrictions; some frameworks expect cloud APIs or GPU resources. | Use selectively for experimental agents; for the core MCP storage, keep SQLite so we stay deterministic and user-controlled. |

**Decision**: Start with SQLite FTS5 because it satisfies offline, deterministic requirements, integrates naturally with the existing file system, and keeps operational complexity low. Leave clear extension points (extra column/table) for embeddings so future vector/RAG experiments can plug in without rewriting the atlas service.

## 14. Seamless Dev Experience with Qodo

- **Custom instruction pack**: Bundle the mental rules, search-first reminders, and atlas save instructions in `custom-instructions.md`. Provide short aliases like "`/atlas-save`" that Qodo can mention when prompting the agent.
- **Tool discovery**: Update `docs/API_Documentation.md` with request/response examples for each atlas tool so developers can experiment quickly.
- **Scaffolding commands**: Add npm scripts:
  - `atlas:init` – create DB/tables under `MEMORY_BANK_ROOT`.
 - `atlas:scan` – run the logical indexing workflow for a given path.
  - `atlas:serve` – start MCP with verbose atlas logging for debugging.
- **Status dashboards**: Emit concise summaries after each scan (e.g., "Indexed 230 flows, 90 rules, 50 data paths"). Optional: write to `atlas/status.json` so Qodo can read latest numbers.
- **Conflict safety**: Provide merge helpers (e.g., instruct agents to call `atlas_get_memory_item` before editing to avoid clobbering concurrent updates).
- **Test data**: Supply a sample `mem/sample_project` with prebuilt atlas entries so new users can see the file layout and tool usage immediately.

With these guardrails, Qodo becomes a reliable assistant that always references the structured atlas instead of recreating knowledge, while developers retain full local control over their memory bank.

## 15. Decision Record (for Future Maintainers)

| ID | Decision | Rationale | Alternatives Considered |
|----|----------|-----------|-------------------------|
| D1 | Use SQLite + FTS5 as the primary index. | Satisfies local-only requirement, easy to bundle, deterministic text search that mirrors markdown structure. | Vector DBs (Chroma, Milvus) add operational overhead; plain files lack fast querying. |
| D2 | Keep markdown as the source of truth with structured metadata front matter. | Humans can edit outside MCP; git-friendly; aligns with existing workflow. | Moving to a pure DB store would break current tooling and make manual edits difficult. |
| D3 | Introduce a JSON payload standard (`atlas_create_memory_item`). | Ensures every agent and workflow produces consistent metadata so the atlas stays coherent. | Allowing ad-hoc payloads would lead to schema drift and broken searches. |
| D4 | Implement diff-driven incremental updates with checkpoints. | Large team commits frequently; we need resumable, deterministic updates rather than ad-hoc re-indexing. | Relying on manual edits risks stale entries and duplicate work. |
| D5 | Separate instructions for ephemeral vs reusable knowledge. | Prevents explosion of markdown files and ensures only durable concepts enter the atlas. | Allowing agents to decide on the fly caused previous sprawl. |
| D6 | Provide a build-from-scratch checklist. | New engineers can bring up the atlas without prior tribal knowledge. | Expecting developers to infer steps from code increases onboarding time. |
| D7 | Store `code_revision` with every atlas entry. | Lets agents warn when entries are stale vs current checkout. | Ignoring revision metadata would make it impossible to detect drift automatically. |

Any future change should either align with these decisions or document a replacement decision (D8, D9, …) with clear justification.

## 16. Implementation Plan (Generic AI Code-Agent Rollout)

This plan assumes we are building a reusable solution for any software team that wants to pair an AI coding agent (Qodo/Sonnet/GPT) with a document-backed MCP + atlas layer. The wealth-management monolith serves as a deliberately complex proving ground, but the plan generalizes to any large codebase.

1. **Phase 0 – Foundations (Week 1)**
   - Stand up `MEMORY_BANK_ROOT` and ensure existing MCP tools (read/write/update/list) work end-to-end.
   - Add SQLite dependencies, migrations (`atlas/index.db`), and the `AtlasService`/controllers on top of the current Node server.
   - Document the JSON payload contract and manual workflow (Section 6.1) so any engineer can capture a UI→DB flow immediately.

2. **Phase 1 – Manual Capture Playbooks (Week 2)**
   - Publish structured prompt templates for Qodo (e.g., investment buy flow) in `docs/workflows/`.
   - Encourage teams to store curated flows via `atlas_create_memory_item` so the atlas gains real content while automation is built.
   - Gather feedback on tags, file naming, and related-files conventions; update docs accordingly.

3. **Phase 2 – Semi-Automated Templates (Weeks 3–4)**
   - Build helper commands/prompts that pre-fill JSON payloads (e.g., CLI `atlas:draft --type flow --name "Investment Buy"` reading from a YAML template).
   - Add validation scripts that ensure every atlas markdown file contains required sections before upsert.
   - Begin capturing supporting artifacts (JSON schemas, diagrams) via `memory_bank_write` and referencing them from atlas entries.

4. **Phase 3 – Atlas Scan Pipeline (Weeks 5–8)**
   - Implement `atlas.config.json`, detectors, and the `atlas:scan` CLI per Sections 4.4 and 1.
   - Start with a subset of modules (e.g., trading) to refine AST parsing, heuristic tagging, and Qodo summarization prompts.
   - Store raw/normalized JSON under `atlas/runs/<timestamp>` so scans are auditable and resumable.

5. **Phase 4 – Incremental Diff Handling (Weeks 9–10)**
   - Wire the diff-aware checkpointing (Section 11.2.1) so engineers can update flows as code changes without redoing entire scans.
   - Ensure `atlas_sync_index` handles manual edits gracefully (e.g., when someone tweaks markdown outside MCP).

6. **Phase 5 – Scale & Hardening (Weeks 1+)**
   - Roll the workflow to additional modules/teams; provide training on the mental rules (Section 9) and instructions (Section 12).
   - Add observability (status dashboards, scan metrics, error alerts) so operations remain stable as the atlas grows.
   - Evaluate optional enhancements (vector search, embeddings) once the SQLite/FTS layer is saturated.

Throughout all phases, keep reinforcing that the atlas is part of the same MCP server. Whether the knowledge originates from a manual Qodo session or an automated scan, it is written as markdown via the existing repositories, indexed via SQLite, and remains discoverable to any AI agent weeks or months later. The complicated wealth-management example guarantees the solution is robust enough for other real-world systems.

## 17. Task Breakdown for Coding Agents

This section enumerates concrete tasks that a low-level coding agent can tackle sequentially. Completing every task below delivers the full functionality described in this document.

### Task Group A – Core Atlas Infrastructure
1. **Create Atlas Directory & Config**
   - Inspect `MEMORY_BANK_ROOT` (read from env). If it does not exist, create it via `mkdir -p`.
   - Inside the root, create folders `mem/flows`, `mem/rules`, `mem/data_paths`, `mem/module_summaries`, `mem/scratch`, `mem/data_specs`, and `atlas/{runs,migrations}`.
   - Drop a `.gitkeep` (empty file) into each new folder so Git tracks them. Use `touch`.
   - Document the created structure in `docs/README.md` so future agents know expected paths.
2. **Add Dependencies**
   - Edit `package.json` to add runtime deps: `"better-sqlite3"`, `"uuid"`, `"slugify"`, `"gray-matter"`, `"proper-lockfile"`.
   - Run `npm install` from repo root; ensure `package-lock.json` updates.
   - Run `npm run lint` (or equivalent) to confirm dependency tree is healthy.
3. **Implement Migration Runner**
   - Create `src/infra/database/sqlite-atlas-repository.ts`.
   - Expose functions: `initAtlasDb()`, `runMigrations()`, `withRead(fn)`, `withWrite(fn)`.
   - `runMigrations` should read SQL files from `atlas/migrations` in lexical order and execute them using the same SQLite connection.
   - Enable WAL mode with `PRAGMA journal_mode=WAL;` and set busy timeout to avoid lock contention.
   - Add a unit test covering migration idempotency.
4. **Create Atlas Service**
   - Add `src/data/services/atlas/atlas-service.ts`.
   - Implement `upsertItem(payload)`:
     - Validate payload fields.
     - Compute `docPath` (slugify name + type).
     - Use existing `FsFileRepository` to write markdown (front matter from §5.3).
     - Insert/update SQLite row inside a transaction; update `memory_items_fts`.
   - Implement `searchItems`, `getItemById`, `syncFromMarkdown` similarly, always using the repository for file I/O.
   - Export an interface so controllers can depend on abstractions.
5. **Wire Controllers**
   - Create `src/presentation/controllers/atlas/{create-controller,search-controller,get-controller,sync-controller}.ts`.
   - Each controller:
     - Accepts validated input.
     - Calls the corresponding service method.
     - Formats responses per MCP spec (status, body).
   - Write validators for required fields (type/name/summary), arrays (tags, relatedFiles), and path traversal checks.
6. **Register MCP Tools**
   - Update `src/main/index.ts` to instantiate the Atlas Service and inject it into the controllers.
   - Register tools in the MCP router with descriptive schemas (see §7 for parameter ideas).
   - Update `docs/API_Documentation.md` with the tool names, params, and sample responses.

### Task Group B – Manual Workflow Support
7. **Markdown Template Enforcement**
   - Implement helper `buildAtlasMarkdown(metadata, body)` under `src/presentation/helpers`.
   - Use `gray-matter` to serialize front matter exactly as in §5.3 (ordered keys: id, type, name, tags, related_files, source, code_revision, last_synced).
   - Call helper from `atlas_create_memory_item` and from sync jobs to keep format consistent.
8. **Instruction & Workflow Docs**
   - Update `custom-instructions.md` with:
     - The "mental rule" from §9.
     - Manual Qodo workflow (Section 6.1) as a numbered checklist.
     - JSON payload template (Section 5.2) for copy/paste.
   - Update `docs/API_Documentation.md` by adding dedicated sections for the four atlas tools, including sample CLI calls.
9. **Sample Data**
   - Create `mem/sample_project/flows/etf_drift_rebalance.md` using the template and realistic content.
   - Call `atlas_create_memory_item` via the MCP client (or directly by invoking the controller) to index the file.
   - Verify via `atlas_search_memory_items query="etf drift"` that it shows up; document the verification steps in `docs/README.md`.

### Task Group C – Atlas Scan Pipeline
10. **atlas.config.json Parser**
    - Define schema (use `zod` or manual validation) for keys: `codebaseRoot`, `include`, `exclude`, detector arrays.
    - Implement loader in `src/data/config/atlas-config.ts` that resolves relative paths based on the CLI `--root`.
11. **Parser Hooks**
    - Integrate Tree-sitter (preferred) or JavaParser via CLI to parse Java files.
      - Write results to `atlas/runs/<timestamp>/raw/<relativePath>.json`.
      - Capture class names, method signatures, annotations, comments.
    - For XML/XSLT resources, use an XML parser (e.g., `fast-xml-parser`) to capture templates, IDs, references.
12. **Detector Modules**
    - Implement detectors as pluggable functions receiving AST JSON and returning candidate artifacts.
    - Start with:
      - `serviceControllers` (public methods in controllers/services).
      - `thresholdChecks` (if/else chains with numeric comparisons).
      - `dtoDefinitions` (classes annotated with `@Data` or similar).
      - `xmlTransforms` and `sqlQueries`.
    - Store detector outputs in memory for normalization step.
13. **Normalization Pipeline**
    - Implement `buildNormalizedPayload(detectorOutput)` that sets type/name/summary/details/tags/relatedFiles.
    - Persist each normalized payload as JSON under `atlas/runs/<ts>/normalized/<uuid>.json`.
    - Include metadata such as `source: "code-index"` and `codeLocation`.
14. **Semantic Summaries**
    - Implement `summarizeArtifact(payload)`:
      - If Qodo API/env available, send prompt with code snippet + context to generate summary-details.
      - If not, fallback to heuristic text (list method names, annotations).
    - Cache summaries in normalized JSON so re-runs can skip already summarized artifacts.
15. **CLI Command**
    - Create `src/cli/atlas-scan.ts`.
    - Support args: `--root`, `--config`, `--checkpoint`, `--incremental`, `--since`.
    - Flow:
      1. Load config + checkpoint.
      2. Walk include globs minus exclude globs.
      3. For each file, parse, detect, normalize.
      4. Either call the service directly to upsert or enqueue payloads and batch insert at the end.
      5. Write checkpoints frequently (after each batch).
    - Expose script via `package.json`: `"atlas:scan": "tsx src/cli/atlas-scan.ts"`.

### Task Group D – Diff Handling & Sync
16. **Checkpoint Manager**
    - Implement utility `atlasCheckpoint` with methods `load(path)`, `save(path, data)`, `markChunkComplete`.
    - Always write to `<path>.tmp` then rename to avoid corruption.
    - Store stats: total files, processed files, created items, updated items, errors, startedAt.
17. **Git Diff Integration**
    - Implement helper `collectChangedFiles({ since })` using `git diff --name-only`.
    - For each file, capture diff chunks with `git diff --unified=0`.
    - Map chunks to atlas entries:
      - Search SQLite for `related_files` containing the file path.
      - Compare line ranges; if no match, flag as new entry.
    - Append chunk info to checkpoint (`pendingChunks` array).
18. **atlas_sync_index Enhancements**
    - Extend sync command to:
      - Walk `mem/**/` for markdown files.
      - Parse front matter; add missing `id`, `code_revision`.
      - Upsert DB rows when markdown changes, delete DB rows for missing files.
      - Report summary (synced, created, deleted).
19. **Version Tagging**
    - During every upsert or scan, fetch current git SHA via `git rev-parse HEAD`.
    - Write `code_revision` to markdown front matter and DB column.
    - Update `atlas_get_memory_item` response to include `code_revision`.

### Task Group E – Advanced Metadata & Optional Features
20. **Call-Graph + Interface Matrix**
    - Use `jdeps`, `ClassGraph`, or Spoon to generate call graphs and interface→implementation tables.
    - Store outputs in `atlas/runs/<ts>/graphs`.
    - Extend normalization step to attach graph references (paths) to `related_files`.
21. **Annotation Detector**
    - Extend parsing to capture annotations such as `@Stateless`, `@EJB`, `@Transactional`, security annotations.
    - Add tags like `annotation:Stateless`, `txn:REQUIRES_NEW`, `role:advisor`.
22. **Domain Registry**
    - Create `docs/domain_entities.yml` listing core entities + synonyms.
    - Build script that maps package names or class annotations to entities.
    - During normalization, tag artifacts with the associated `entity:Account` etc.
23. **Javadoc Harvesting**
    - Modify parser pipeline to capture Javadoc comments per method/class.
    - Prefill `details` section with captured comments before LLM summary so manual context is preserved.
24. **Diagram Asset Workflow**
    - Provide a template for Mermaid sequence diagrams (store in `docs/templates/sequence-diagram.md`).
    - Add CLI helper that, after generating normalized payloads, prompts the agent to create diagrams for complex flows and stores them via `memory_bank_write`.
    - Include diagram paths in `related_files`.
25. **Vector Search (Optional)**
    - Add optional dependency (`sqlite-vec` or a lightweight vector DB).
    - Implement script to compute embeddings for each summary/detail using a local model.
    - Store embeddings in `memory_item_embeddings` table and expose `atlas_semantic_search` tool that performs cosine similarity + FTS hybrid ranking.

### Task Group F – Observability & Quality
26. **Status Dashboard**
    - Create `atlas/status.json` and update it after each scan or sync.
    - Fields: `lastFullScan`, `lastIncrementalScan`, counts per type, average scan duration, last error message.
27. **Testing**
    - Write unit tests for:
      - Atlas service (mocking repositories).
      - Detectors (feed sample AST JSON, assert outputs).
      - Config loader + checkpoint manager.
    - Write integration tests using tmp directories to ensure full flow (create item → search → get) works.
28. **CI Hooks**
    - Update CI pipeline (GitHub Actions or similar) to run `npm run lint`, `npm run test`, and optionally `npm run atlas:scan -- --root ./fixtures` on each PR.
    - Add nightly/scheduled job that runs `atlas:scan --status` and posts results (e.g., to a log file or dashboard).

Each task includes explicit creation steps, file paths, and verification instructions so a coding agent can execute independently. Work through the tasks in order; after finishing a task, confirm functionality (tests/logs) before moving to the next one.

Once all tasks are completed, engineers and coding agents can reliably capture, update, and query complex Java/EJB flows (or any other domain) with a consistent atlas backed by the existing MCP server. Low-level agents should work through the tasks in order, verifying each step with the provided tooling (MCP commands, npm scripts, logs) before moving on.

3 days max investment
