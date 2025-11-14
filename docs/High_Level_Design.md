# High Level Design (HLD)

## 1. System Context

The Memory Bank MCP Server operates as a service that bridges AI assistants and development tools with project-specific memory banks. It provides a standardized interface for managing knowledge and context across multiple projects.

**System Boundaries**: The server acts as an intermediary between AI assistants and the file system, providing a controlled interface for memory bank operations while maintaining security and isolation.

**External Dependencies**:
- **AI Assistants**: Claude, Cursor, Cline, Roo Code (MCP protocol clients)
- **File System**: Local file system for storage (configurable root directory)
- **MCP Protocol**: Standard protocol for AI assistant communication

**Design Rationale**: The system is designed to be lightweight and focused on the core use case of memory bank management, avoiding unnecessary complexity while maintaining security and performance.

## 2. Major Components

### 2.1 MCP Protocol Handler
**Responsibility**: Handle MCP protocol communication and routing
- **McpServerAdapter**: Main server entry point implementing MCP protocol
  - *Purpose*: Manages MCP handshake, maintains protocol compliance
  - *Implementation*: Uses @modelcontextprotocol/sdk for standard compliance
 - *Rationale*: Centralizes protocol handling to ensure consistency across all operations
  - *Configuration*: Registers server name and version with MCP protocol

- **McpRouterAdapter**: Routes tool calls to appropriate controllers
  - *Purpose*: Maps MCP tool names to specific controller handlers
  - *Implementation*: Maintains registry of available tools and their schemas
  - *Rationale*: Enables dynamic tool registration and maintains clean separation
  - *Security*: Validates tool schemas before routing requests

- **McpRequestAdapter**: Transforms MCP requests to internal format
  - *Purpose*: Adapts MCP-specific request format to internal request objects
  - *Implementation*: Converts MCP parameters to internal request structures
  - *Rationale*: Decouples internal architecture from MCP protocol specifics
  - *Benefits*: Enables easier testing and internal consistency

**Interfaces**:
- MCP Protocol (stdio communication)
- Tool schemas for each operation (list_projects, list_project_files, memory_bank_read, memory_bank_write, memory_bank_update)

### 2.2 Presentation Layer
**Responsibility**: Handle request processing and response formatting
- **Controllers**: Process requests and coordinate with use cases
   - *Purpose*: Orchestrate request processing and response formatting
   - *Implementation*: Each controller handles one specific operation type
   - *Rationale*: Single responsibility principle - each controller handles one operation
   - *Error Handling*: Centralized error handling and response formatting
   - *Examples*: ReadController, WriteController, UpdateController, ListProjectsController, ListProjectFilesController, AppendFileController, LogFileController, ListFileVersionsController, GetFileVersionController, RevertFileVersionController

- **Validators**: Validate input parameters and business rules
  - *Purpose*: Ensure data integrity and security before processing
  - *Implementation*: Composite validator pattern combining multiple validation rules
  - *Rationale*: Early validation prevents invalid data from reaching business logic
  - *Security*: Prevents path traversal and validates input formats
  - *Components*: RequiredFieldValidator, ParamNameValidator, PathSecurityValidator, ValidatorComposite

- **Response Helpers**: Format standardized responses
  - *Purpose*: Consistent response format across all operations
  - *Implementation*: Helper functions for success, error, and not-found responses
 - *Rationale*: Simplifies response formatting and ensures MCP compliance
  - *Benefits*: Consistent error handling across all controllers

**Key Classes**:
- ReadController: Handles memory bank read operations
- WriteController: Handles memory bank write operations  
- UpdateController: Handles memory bank update operations
- ListProjectsController: Handles project listing operations
- ListProjectFilesController: Handles project file listing operations

### 2.3 Business Logic Layer
**Responsibility**: Implement core business rules and orchestrate operations
- **Use Cases**: Execute business logic for each operation
  - *Purpose*: Encapsulate business rules and coordinate data access
  - *Implementation*: Each use case implements specific business operation
  - *Rationale*: Centralizes business logic for consistency and testability
 - *Dependency Injection*: Uses repository interfaces for data access
  - *Examples*: ReadFile, WriteFile, UpdateFile, ListProjects, ListProjectFiles

- **Domain Entities**: Core business objects and their relationships
  - *Purpose*: Define core business concepts and their relationships
  - *Implementation*: Simple type definitions (Project = string, File = string)
  - *Rationale*: Keep domain entities pure and focused on business concepts
  - *Extensibility*: Simple structure allows for future enhancements

**Key Classes**:
- ReadFile: Handles file reading with project validation
- WriteFile: Handles file creation with project creation and validation
- UpdateFile: Handles file updates with existence validation
- ListProjects: Handles project listing with directory scanning
- ListProjectFiles: Handles project file listing with directory scanning

### 2.4 Data Access Layer
**Responsibility**: Define contracts for data operations
- **Repository Protocols**: Interface definitions for data access
  - *Purpose*: Abstract data storage implementation details
  - *Implementation*: TypeScript interfaces defining data access contracts
 - *Rationale*: Enables different storage backends (file system, database)
  - *Benefits*: Easy to mock for testing and enables dependency inversion

- **Data Access Objects**: Business logic for data operations
  - *Purpose*: Implement business logic specific to data operations
  - *Implementation*: Validates data access rules before storage operations
  - *Rationale*: Keep business logic out of infrastructure layer
  - *Security*: Implements data access validation and business rules

**Key Interfaces**:
- FileRepository: Defines file operations contract
- ProjectRepository: Defines project operations contract

### 2.5 Infrastructure Layer
**Responsibility**: Implement concrete data access using file system
- **File System Repositories**: Concrete implementations using fs-extra
  - *Purpose*: Handle actual file system operations
  - *Implementation*: Uses fs-extra for enhanced file system capabilities
  - *Rationale*: fs-extra provides safer and more robust file system operations
  - *Security*: Implements path validation and file access controls

- **Path Management**: Handle file system paths and validation
  - *Purpose*: Ensure secure and valid file system path operations
  - *Implementation*: Path building and validation methods
  - *Rationale*: Critical security layer preventing path traversal attacks
  - *Security*: Multiple validation layers for path safety

**Key Classes**:
- FsFileRepository: File system implementation of FileRepository
- FsProjectRepository: File system implementation of ProjectRepository

## 3. Data Flow Diagrams

### 3.1 Read Operation Flow
```
1. AI Assistant → MCP Protocol → McpServerAdapter
   - MCP client sends read request with projectName and fileName
   - Server validates MCP protocol compliance and registers tools

2. McpServerAdapter → McpRouterAdapter → Route "memory_bank_read"
   - Router identifies tool name "memory_bank_read" and maps to ReadController
   - Validates request against tool schema definition

3. McpRouterAdapter → McpRequestAdapter → Adapt request
   - Converts MCP request format to internal request object
   - Ensures parameter names and types match expected format

4. McpRequestAdapter → ReadController → Validate input
   - Controller validates required parameters (projectName, fileName)
   - Security validation prevents path traversal attempts
   - Ensures parameters meet business rules

5. ReadController → ReadFile use case → Validate project existence
   - Use case validates that specified project exists
   - Coordinates with ProjectRepository to check project validity
   - Ensures project isolation and access control

6. ReadFile → FsFileRepository → Load file content
   - Repository loads file content from file system
   - Applies path validation and security checks
   - Returns file content or null if not found

7. FsFileRepository → File system → Read file
   - Direct file system read operation using fs-extra
   - Handles file encoding (UTF-8) and error conditions
   - Returns file content as string

8. Return content through chain → AI Assistant
   - Content flows back through repository → use case → controller → MCP adapter
   - Each layer formats response according to MCP protocol
   - AI Assistant receives file content for processing
```

**Security Considerations**: Each step includes validation to prevent unauthorized access and path traversal attacks.

### 3.2 Write Operation Flow
```
1. AI Assistant → MCP Protocol → McpServerAdapter
   - MCP client sends write request with projectName, fileName, and content
   - Protocol validation ensures request format compliance

2. McpServerAdapter → McpRouterAdapter → Route "memory_bank_write"
   - Router maps tool name "memory_bank_write" to WriteController
   - Validates all required parameters (projectName, fileName, content)

3. McpRouterAdapter → McpRequestAdapter → Adapt request
   - Converts MCP parameters to internal WriteRequest format
   - Ensures parameter types and names match expectations

4. McpRequestAdapter → WriteController → Validate input
   - Validates all required parameters exist and are properly formatted
   - Security validation prevents path traversal in fileName
   - Content validation ensures valid UTF-8 content

5. WriteController → WriteFile use case → Ensure project exists
   - Use case ensures target project exists (creates if needed)
   - Coordinates with ProjectRepository to ensure project directory exists
   - Maintains project isolation and proper directory structure

6. WriteFile → FsFileRepository → Write file content
   - Repository writes content to file system with validation
   - Checks if file already exists (write operations should not overwrite)
   - Ensures file is created in correct project directory

7. FsFileRepository → File system → Create file
   - Direct file system write operation using fs-extra
   - Creates project directory if it doesn't exist
   - Writes content with proper encoding (UTF-8)

8. Return success through chain → AI Assistant
   - Success confirmation flows back through all layers
   - Each layer formats response according to MCP standards
   - AI Assistant receives confirmation of successful write
```

**Business Rules**: Write operations create new files only (no overwrites), project directories are created automatically.

### 3.3 List Projects Flow
```
1. AI Assistant → MCP Protocol → McpServerAdapter
   - MCP client sends list_projects request (no parameters required)
   - Protocol validation confirms valid tool call

2. McpServerAdapter → McpRouterAdapter → Route "list_projects"
   - Router identifies tool name "list_projects" and maps to ListProjectsController
   - Validates request schema (no parameters expected)

3. McpRouterAdapter → McpRequestAdapter → Adapt request
   - Converts MCP request to internal ListProjectsRequest format
   - No parameters to adapt, but maintains consistent interface

4. McpRequestAdapter → ListProjectsController → Process request
   - Controller validates request (no validation needed for list_projects)
   - Invokes ListProjects use case to retrieve available projects

5. ListProjectsController → ListProjects use case → List available projects
   - Use case coordinates with ProjectRepository to list projects
   - Maintains business logic for project listing operations
   - Ensures consistent response format

6. ListProjects → FsProjectRepository → Read directory entries
   - Repository reads directory entries from configured root directory
   - Filters to return only directories (projects, not files)
   - Applies path validation and security checks

7. FsProjectRepository → File system → List directories
   - Direct file system directory listing using fs-extra
   - Returns list of directory names (project names)
   - Handles error conditions and permissions

8. Return project list through chain → AI Assistant
   - Project list flows back through repository → use case → controller → MCP adapter
   - Each layer formats response according to MCP protocol
   - AI Assistant receives array of project names
```

**Performance Considerations**: Directory listing performance depends on number of projects in root directory.

## 4. Component Interactions

### 4.1 Dependency Flow
```
External Clients → MCP Layer → Presentation → Business Logic → Data Access → Infrastructure
```
- **Unidirectional Dependencies**: Dependencies flow inward following Clean Architecture
- **Interface Abstraction**: Each layer depends on abstractions, not concrete implementations
- **Inversion of Control**: High-level modules don't depend on low-level modules

### 4.2 Error Handling Flow
```
Infrastructure → Data Access → Business Logic → Presentation → MCP Layer → External Clients
```
- **Graceful Degradation**: Errors are caught and transformed at each layer
- **MCP Compliance**: Final errors follow MCP protocol error response format
- **Security**: Error messages don't leak sensitive system information

## 5. Configuration Management

### 5.1 Environment Variables
- **MEMORY_BANK_ROOT**: Root directory for all project memory banks
  - *Purpose*: Defines base directory for all memory bank storage
  - *Security*: Limits server access to specific directory tree
  - *Flexibility*: Allows different root paths per deployment environment
 - *Validation*: Server validates directory exists and is accessible

- **Server Configuration**: MCP protocol settings through client configuration
 - *Purpose*: MCP client handles server registration and configuration
  - *Security*: Auto-approval settings control operation permissions
  - *Flexibility*: Different settings per client type (Claude, Cursor, etc.)

### 5.2 Runtime Dependencies
- File system access to configured root directory
  - *Validation*: Server checks directory permissions at startup
  - *Security*: All operations confined to configured root directory
  - *Performance*: Direct file system access for optimal performance

- MCP client configuration in AI assistant settings
  - *Purpose*: MCP protocol handles client-server communication
  - *Security*: Client controls which operations are auto-approved
 - *Reliability*: stdio communication ensures reliable data transfer

- Network communication (stdio for MCP protocol)
  - *Implementation*: MCP protocol uses stdio for communication
  - *Security*: No network exposure, communication through stdin/stdout
  - *Performance*: Efficient communication channel for AI assistant integration

## 6. Performance Considerations

### 6.1 Current Performance Characteristics
- File system I/O operations for each request
  - *Rationale*: Direct file system access provides optimal performance for small-medium files
  - *Impact*: Performance scales with file system performance
  - *Optimization*: fs-extra provides optimized file operations
- Caching mechanism implemented with intelligent TTL management
   - *Rationale*: Many memory bank files are accessed repeatedly during AI assistant sessions
   - *Implementation*: In-memory cache with 30-minute TTL and automatic invalidation
   - *Performance*: Significantly reduced file system I/O for frequently accessed files
   - *Features*: Cache invalidation on write/update operations, project-based cache management

- Synchronous operations throughout the chain
   - *Rationale*: MCP protocol's request-response model works well with synchronous operations
   - *Impact*: Each request is processed completely before next request
   - *Consideration*: May limit concurrent request handling

- File versioning with automatic backup management
   - *Rationale*: Provides history and rollback capabilities for memory bank files
   - *Implementation*: Automatic creation of timestamped backups before updates
   - *Features*: list_file_versions, get_file_version, revert_file_version operations
   - *Management*: cleanupOldVersions with configurable retention policies


### 6.2 Optimization Opportunities
- File content caching for frequently accessed files
  - *Implementation*: In-memory cache with TTL and LRU eviction
  - *Benefits*: Reduced file system I/O for repeated access
  - *Considerations*: Memory usage vs. performance trade-offs

- Asynchronous I/O operations
  - *Implementation*: Use async/await patterns consistently
  - *Benefits*: Better concurrent request handling
  - *Considerations*: MCP protocol's single-request model may limit benefits

- Connection pooling for concurrent requests
 - *Implementation*: Handle multiple concurrent MCP connections
  - *Benefits*: Better resource utilization under load
 - *Considerations*: MCP protocol typically uses single connection per client

## 7. Security Considerations

### 7.1 Input Validation
- Project name validation to prevent path traversal
  - *Implementation*: Validates project names against allowed character patterns
  - *Security*: Blocks "../" and other traversal sequences
  - *Rationale*: Critical protection against unauthorized file access

- File name validation and sanitization
  - *Implementation*: Validates file names against safe file system patterns
  - *Security*: Prevents special characters that could be used for attacks
  - *Rationale*: Maintains file system integrity and security

- Content validation for write/update operations
  - *Implementation*: Validates content encoding and size limits
  - *Security*: Prevents malicious content injection
  - *Rationale*: Protects against content-based attacks

### 7.2 Access Control
- Root directory restriction
  - *Implementation*: All operations confined to MEMORY_BANK_ROOT directory
 - *Security*: Prevents access to system files outside configured root
  - *Rationale*: Fundamental security boundary for file system access

- Project-level isolation
  - *Implementation*: Each operation validates project context and access
  - *Security*: Prevents cross-project data access
  - *Rationale*: Maintains data separation between different projects

- Read/write permission through MCP auto-approval
  - *Implementation*: MCP client controls which operations are auto-approved
  - *Security*: Fine-grained permission control per operation type
  - *Rationale*: Leverages MCP protocol's built-in permission system