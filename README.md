# Membank MCP Server

[![smithery badge](https://smithery.ai/badge/@alioshr/membank)](https://smithery.ai/server/@alioshr/membank)
[![npm version](https://badge.fury.io/js/membank.svg)](https://www.npmjs.com/package/membank)
[![npm downloads](https://img.shields.io/npm/dm/membank.svg)](https://www.npmjs.com/package/membank)

<a href="https://glama.ai/mcp/servers/ir18x1tixp"><img width="380" height="200" src="https://glama.ai/mcp/servers/ir18x1tixp/badge" alt="Memory Bank Server MCP server" /></a>

A Model Context Protocol (MCP) server implementation for remote memory bank management, inspired by [Cline Memory Bank](https://github.com/nickbaumann98/cline_docs/blob/main/prompting/custom%20instructions%20library/cline-memory-bank.md).

## Overview

The Memory Bank MCP Server transforms traditional file-based memory banks into a centralized service that:

- Provides remote access to memory bank files via MCP protocol
- Enables multi-project memory bank management
- Maintains consistent file structure and validation
- Ensures proper isolation between project memory banks

## Features

- **Multi-Project Support**

  - Project-specific directories
  - File structure enforcement
  - Path traversal prevention
  - Project listing capabilities
  - File listing per project

- **Remote Accessibility**

  - Full MCP protocol implementation
  - Type-safe operations
  - Proper error handling
  - Security through project isolation

- **Core Operations**
  - Read/write/update memory bank files
  - List available projects
  - List files within projects
  - Project existence validation
  - Safe read-only operations

## MCP Tool Reference

Each MCP tool exposes a strict schema so agents know exactly which arguments are required. Use the table below to understand the contract for every tool the server registers.

| Tool | Description | Required fields |
| --- | --- | --- |
| `list_projects` | List all projects stored under the configured `MEMORY_BANK_ROOT`. | *(none)* |
| `list_project_files` | List files within a specific project directory. | `projectName` |
| `memory_bank_read` | Read the contents of a project file. | `projectName`, `fileName` |
| `memory_bank_write` | Create a file with the provided content (fails if file exists). | `projectName`, `fileName`, `content` |
| `memory_bank_update` | Overwrite a file’s contents. | `projectName`, `fileName`, `content` |
| `memory_bank_append` | Append content to the end of a file. | `projectName`, `fileName`, `content` |
| `memory_bank_log` | Append a timestamped log entry to a file. | `projectName`, `fileName`, `content` |
| `get_file_version` | Fetch a specific historical version of a file. | `projectName`, `fileName`, `versionId` |
| `list_file_versions` | List available version IDs (timestamps) for a file. | `projectName`, `fileName` |
| `revert_file_version` | Restore a file to a previous version. | `projectName`, `fileName`, `versionId` |

## Installation

To install Memory Bank Server for Claude Desktop automatically via [Smithery](https://smithery.ai/server/@alioshr/membank):

```bash
npx -y @smithery/cli install @alioshr/membank --client claude
```

This will set up the MCP server configuration automatically. Alternatively, you can configure the server manually as described in the Configuration section below.

## Quick Start

1. Configure the MCP server in your settings (see Configuration section below)
2. Start using the memory bank tools in your AI assistant

## Documentation

- [Structured Memory Atlas](docs/Structured_Memory_Atlas.md) – guidance for organizing project memories
- [High Level Design](bank/docs/High_Level_Design.md) – components, flows, and responsibilities
- [Architecture Document](bank/docs/Architecture_Document.md) – deep dive into layers and data access patterns
- [Custom AI Instructions](custom-instructions.md) – copy/paste rules for MCP-aware assistants

## Using with Cline/Roo Code

The memory bank MCP server needs to be configured in your Cline MCP settings file. The location depends on your setup:

- For Cline extension: `~/Library/Application Support/Cursor/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json`
- For Roo Code VS Code extension: `~/Library/Application Support/Code/User/globalStorage/rooveterinaryinc.roo-cline/settings/mcp_settings.json`

Add the following configuration to your MCP settings:

```json
{
  "membank": {
    "command": "npx",
    "args": ["-y", "membank"],
    "env": {
      "MEMORY_BANK_ROOT": "<path-to-bank>"
    },
    "disabled": false,
    "autoApprove": [
      "memory_bank_read",
      "memory_bank_write",
      "memory_bank_update",
      "list_projects",
      "list_project_files"
    ],
    "alwaysAllow": [
      "list_projects",
      "list_project_files",
      "memory_bank_read",
      "memory_bank_write",
      "memory_bank_update",
      "memory_bank_append",
      "memory_bank_log",
      "get_file_version",
      "list_file_versions",
      "revert_file_version"
    ]
  }
}
```

### Example MCP Config (Global CLI)

If you install `membank` globally (e.g., `npm install -g membank`), you can point MCP servers directly at the binary:

```json
{
  "mcpServers": {
    "membank": {
      "command": "membank",
      "args": [],
      "env": {
        "MEMORY_BANK_ROOT": "/path/to/your/bank"
      },
      "disabled": false,
      "autoApprove": [
        "memory_bank_read",
        "memory_bank_write",
        "memory_bank_update",
        "list_projects",
        "list_project_files"
      ],
      "alwaysAllow": [
        "list_projects",
        "list_project_files",
        "memory_bank_read",
        "memory_bank_write",
        "memory_bank_update",
        "memory_bank_append",
        "memory_bank_log",
        "get_file_version",
        "list_file_versions",
        "revert_file_version"
      ]
    }
  }
}
```

### Configuration Details

- `MEMORY_BANK_ROOT`: Directory where project memory banks will be stored (e.g., `/path/to/memory-bank`)
- `disabled`: Set to `false` to enable the server
- `autoApprove`: List of operations that don't require explicit user approval:
  - `memory_bank_read`: Read memory bank files
  - `memory_bank_write`: Create new memory bank files
  - `memory_bank_update`: Update existing memory bank files
  - `list_projects`: List available projects
  - `list_project_files`: List files within a project

## Using with Cursor

For Cursor, open the settings -> features -> add MCP server -> add the following:

```shell
env MEMORY_BANK_ROOT=<path-to-bank> npx -y membank@latest
```

### CLI Usage

Once installed (globally or via `npx`), you can run the server directly:

```bash
MEMORY_BANK_ROOT=/path/to/bank membank
```

It communicates over stdio, so pair it with an MCP-aware client (Cursor, Cline, Claude, etc.) configured as shown above.
## Using with Claude

- Claude desktop config file: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Claude Code config file:  `~/.claude.json`

1. Locate the config file
3. Locate the property called `mcpServers`
4. Paste this:

```
 "membank": {
          "type": "stdio",
          "command": "npx",
          "args": [
            "-y",
            "membank@latest"
          ],
          "env": {
            "MEMORY_BANK_ROOT": "YOUR PATH"
          }
        }
```

## Custom AI instructions

This section contains the instructions that should be pasted on the AI custom instructions, either for Cline, Claude or Cursor, or any other MCP client. You should copy and paste these rules. For reference, see [custom-instructions.md](custom-instructions.md) which contains these rules.

## Development

Basic development commands:

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run the server directly with ts-node for quick testing
npm run dev
```

### Running with Docker

1. Build the Docker image:

    ```bash
    docker build -t membank:local .
    ```

2. Run the Docker container for testing:

    ```bash
    docker run -i --rm \
      -e MEMORY_BANK_ROOT="/mnt/memory_bank" \
      -v /path/to/memory-bank:/mnt/memory_bank \
      --entrypoint /bin/sh \
      membank:local \
      -c "ls -la /mnt/memory_bank"
    ```

3. Add MCP configuration, example for Roo Code:

    ```json
    "membank": {
      "command": "docker",
      "args": [
        "run", "-i", "--rm",
        "-e", 
        "MEMORY_BANK_ROOT",
        "-v", 
        "/path/to/memory-bank:/mnt/memory_bank",
        "membank:local"
      ],
      "env": {
        "MEMORY_BANK_ROOT": "/mnt/memory_bank"
      },
      "disabled": false,
      "alwaysAllow": [
        "list_projects",
        "list_project_files",
        "memory_bank_read",
        "memory_bank_update",
        "memory_bank_write"
      ]
    }
    ```

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Use TypeScript for all new code
- Maintain type safety across the codebase
- Add tests for new features
- Update documentation as needed
- Follow existing code style and patterns

### Testing

- Write unit tests for new features
- Include multi-project scenario tests
- Test error cases thoroughly
- Validate type constraints
- Mock filesystem operations appropriately

### Release Checklist

1. Update `package.json` version following semver.
2. Run `npm run test` and `npm run build`.
3. Inspect the publish output with `npm pack --dry-run`.
4. Publish with `npm publish --access public` (first release) or `npm publish`.
5. Tag the release (`git tag vX.Y.Z && git push --tags`) and update docs if anything changed.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

This project implements the memory bank concept originally documented in the [Cline Memory Bank](https://github.com/nickbaumann98/cline_docs/blob/main/prompting/custom%20instructions%20library/cline-memory-bank.md), extending it with remote capabilities and multi-project support.
