# Architecture Document

## 1. System Overview

The Memory Bank MCP Server is a TypeScript-based application that implements the Model Context Protocol (MCP) to provide remote management of project memory banks. The system follows a clean architecture pattern with clear separation of concerns between presentation, business logic, data access, and infrastructure layers.

**Architectural Rationale**: Clean Architecture was chosen to ensure:
- **Maintainability**: Business logic remains isolated from external dependencies
- **Testability**: Each layer can be tested independently
- **Flexibility**: Easy to swap implementations (e.g., storage backends)
- **Scalability**: Clear boundaries allow for distributed development

**Design Decisions**:
- **Layered Architecture**: Each layer has specific responsibilities and dependencies flow inward
- **Dependency Inversion**: High-level modules don't depend on low-level modules directly
- **Interface Segregation**: Each layer defines its own contracts through interfaces

## 2. Architectural Style

The system follows **Clean Architecture** principles with the following characteristics:

- **Dependency Rule**: Dependencies flow inward, from outer layers to inner layers
  - *Reasoning*: Inner layers (business logic) remain independent of outer layers (frameworks, UI)
  - *Example*: Use cases don't depend on controllers or database implementations

- **Separation of Concerns**: Clear boundaries between different architectural layers
  - *Reasoning*: Each layer focuses on specific responsibilities
  - *Example*: Presentation layer handles HTTP/MCP protocol, business layer handles logic

- **Testability**: Each layer can be tested independently
  - *Reasoning*: Isolated layers with defined interfaces enable unit testing
  - *Example*: Use cases can be tested with mock repositories

- **Framework Independence**: Business logic is not tied to specific frameworks
  - *Reasoning*: Business rules remain stable even when frameworks change
  - *Example*: Core logic works regardless of MCP protocol version

- **UI Independence**: Presentation layer can be swapped without affecting business logic
  - *Reasoning*: Same business logic can serve different UI protocols
  - *Example*: Could support both MCP and REST APIs with same use cases

## 3. High-Level Architecture

```
External Clients (AI Assistants)
     ↓
MCP Protocol Layer (Adapters, Routers)
     ↓
Presentation Layer (Controllers, Validators)
     ↓
Business Logic Layer (Use Cases, Entities)
     ↓
Data Access Layer (Repository Interfaces)
     ↓
Infrastructure Layer (File System, Databases)
```

### 3.1 MCP Protocol Layer
- **MCP Server Adapter**: Entry point for MCP protocol communication
  - *Purpose*: Handles MCP handshake and maintains protocol compliance
  - *Implementation*: Uses @modelcontextprotocol/sdk for standard compliance
  - *Rationale*: Centralizes protocol handling to ensure consistency

- **MCP Router**: Routes MCP tool calls to appropriate handlers
  - *Purpose*: Maps tool names to specific controller handlers
  - *Rationale*: Enables dynamic tool registration and routing
  - *Example*: "memory_bank_read" → ReadController

- **MCP Request Adapter**: Adapts MCP requests to internal request format
  - *Purpose*: Transforms MCP-specific requests to internal format
  - *Rationale*: Decouples internal architecture from MCP protocol specifics
  - *Benefits*: Easier testing and internal consistency

### 3.2 Presentation Layer
- **Controllers**: Handle incoming requests and coordinate with use cases
  - *Purpose*: Orchestrate request processing and response formatting
  - *Responsibilities*: Input validation, use case invocation, error handling
  - *Rationale*: Single responsibility principle - each controller handles one operation

- **Validation Layer**: Validates input parameters and enforces business rules
  - *Purpose*: Ensures data integrity and security before processing
  - *Components*: Composite validator pattern for multiple checks
  - *Security*: Prevents path traversal and validates input formats

- **Response Helpers**: Standardized error and success response formatting
  - *Purpose*: Consistent response format across all operations
  - *Benefits*: Simplifies client-side error handling
  - *MCP Compliance*: Follows MCP error response standards

### 3.3 Business Logic Layer
- **Use Cases**: Implement core business logic and orchestrate operations
  - *Purpose*: Encapsulate business rules and coordinate data access
  - *Rationale*: Centralizes business logic for consistency
  - *Example*: ReadFile use case validates project existence before reading

- **Domain Entities**: Represent core business objects (Project, File)
  - *Purpose*: Define core business concepts and their relationships
  - *Simplicity*: Currently simple string types, but extensible for future features
  - *Rationale*: Keep domain entities pure and focused on business concepts

- **Use Case Protocols**: Define contracts for business operations
  - *Purpose*: Enable dependency injection and testing
  - *Rationale*: Allows different implementations of same interface
  - *Benefits*: Flexibility for future extensions

### 3.4 Data Access Layer
- **Repository Protocols**: Define data access contracts
  - *Purpose*: Abstract data storage implementation details
  - *Rationale*: Enables different storage backends (file system, database)
  - *Benefits*: Easy to mock for testing

- **Data Access Objects**: Implement business logic for data operations
  - *Purpose*: Handle data-specific business rules
  - *Example*: Ensure project exists before file operations
  - *Rationale*: Keep business logic out of infrastructure layer

### 3.5 Infrastructure Layer
- **File System Implementation**: Concrete implementations using fs-extra
  - *Purpose*: Handle actual file system operations
  - *Rationale*: fs-extra provides enhanced file system capabilities
  - *Benefits*: Cross-platform file operations

- **FS File Repository**: Handles file operations (read, write, update, list)
   - *Purpose*: Concrete implementation of file repository interface
   - *Security*: Implements path validation and file access controls
   - *Performance*: Optimized for file system operations

- **Cached File Repository**: Handles intelligent caching with TTL management
   - *Purpose*: Caches frequently accessed files to improve performance
   - *Implementation*: In-memory cache with 30-minute TTL and automatic invalidation
   - *Performance*: Reduces file system I/O for frequently accessed content
   - *Features*: Cache invalidation on write/update operations, project-based cache management

- **FS Project Repository**: Handles project operations (list, existence check, creation)
     - *Purpose*: Concrete implementation of project repository interface
     - *Rationale*: Manages project directory structure and validation
     - *Benefits*: Automatic project creation and validation

- **Versioning Support**: Automatic file versioning and management capabilities
    - *Purpose*: Provides history and rollback capabilities for memory bank files
    - *Implementation*: Timestamped file versions with automatic backup before updates
    - *Features*: list_file_versions, get_file_version, revert_file_version operations
    - *Management*: cleanupOldVersions with configurable retention policies

- **Caching Layer**: Intelligent caching with TTL management
    - *Purpose*: Improves performance by caching frequently accessed files
    - *Implementation*: In-memory cache with 30-minute TTL and automatic invalidation
    - *Features*: Cache invalidation on write/update operations, project-based cache management
    - *Performance*: Reduces file system I/O for frequently accessed content

- **Versioning Support**: Automatic file versioning and management capabilities
   - *Purpose*: Provides history and rollback capabilities for memory bank files
   - *Implementation*: Timestamped file versions with automatic backup before updates
   - *Features*: list_file_versions, get_file_version, revert_file_version operations
   - *Management*: cleanupOldVersions with configurable retention policies

## 4. Technology Stack

### Runtime Environment
- **Node.js**: JavaScript runtime environment
  - *Rationale*: Wide ecosystem and excellent for I/O operations
  - *Benefits*: Cross-platform compatibility and extensive libraries
  - *Considerations*: Single-threaded nature handled by async operations

- **TypeScript**: Type-safe superset of JavaScript
  - *Rationale*: Prevents runtime errors and improves developer experience
  - *Benefits*: Better IDE support, refactoring safety, documentation
  - *Trade-offs*: Additional compilation step but worth the benefits

- **fs-extra**: Enhanced filesystem operations
  - *Rationale*: Provides safer and more robust file system operations
  - *Benefits*: Promise-based APIs, path safety, cross-platform handling
  - *Security*: Built-in path validation and safety features

### Protocol Implementation
- **@modelcontextprotocol/sdk**: MCP protocol implementation
  - *Rationale*: Official MCP protocol implementation for standard compliance
  - *Benefits*: Maintained by protocol authors, follows specifications
  - *Considerations*: Version compatibility and protocol evolution

### Development Tools
- **npm**: Package management
  - *Rationale*: Standard Node.js package manager with large ecosystem
  - *Benefits*: Dependency management, scripts, publishing capabilities

- **vitest**: Testing framework
  - *Rationale*: Fast, modern testing framework with excellent TypeScript support
  - *Benefits*: Fast test execution, good mocking capabilities
  - *Performance*: Significantly faster than Jest for TypeScript projects

- **Docker**: Containerization
  - *Rationale*: Ensures consistent deployment across environments
  - *Benefits*: Easy distribution, environment consistency, isolation
  - *Scalability*: Enables container orchestration for future scaling

## 5. Deployment Architecture

### 5.1 Standalone Deployment
```
AI Assistant → MCP Configuration → Memory Bank MCP Server → File System
```
- *Architecture*: Single binary execution model
- *Benefits*: Simple deployment, minimal dependencies
- *Considerations*: Single point of failure, no horizontal scaling
- *Use Case*: Individual developers, small teams

### 5.2 Docker Deployment
```
Container Runtime → Docker Container → Memory Bank MCP Server → Mounted Volume
```
- *Architecture*: Containerized deployment with volume mounting
- *Benefits*: Environment consistency, easy scaling, resource isolation
- *Considerations*: Volume mounting for persistent storage
- *Use Case*: Production deployments, team environments

## 6. Security Architecture

### 6.1 Input Validation
- Parameter validation at controller level
  - *Rationale*: Early validation prevents invalid data from reaching business logic
  - *Implementation*: Composite validator pattern with multiple checks
  - *Security*: Prevents injection attacks and data corruption

- Path sanitization to prevent traversal attacks
  - *Rationale*: Critical security measure to prevent unauthorized file access
  - *Implementation*: Validates file paths against allowed patterns
  - *Security*: Blocks "../" and other traversal sequences

- Project and file existence validation
  - *Rationale*: Prevents operations on non-existent resources
  - *Security*: Reduces information disclosure about file structure
  - *Performance*: Early validation prevents unnecessary file system calls

### 6.2 Access Control
- Environment variable-based root path configuration
  - *Rationale*: Limits server access to specific directory tree
  - *Security*: Prevents access to system files outside configured root
  - *Flexibility*: Allows different root paths per deployment

- Project-level isolation
  - *Rationale*: Prevents cross-project data access
  - *Implementation*: Each operation validates project context
  - *Security*: Maintains data separation between projects

- Read/Write permission controls through MCP auto-approval
  - *Rationale*: Leverages MCP protocol for permission management
  - *Security*: Allows fine-grained permission control per operation
  - *Flexibility*: Can be configured per client and operation type

### 6.3 Data Security
- File system-based storage with proper permissions
  - *Rationale*: Leverages OS-level file permissions for additional security
  - *Security*: OS-level access controls provide additional protection layer
  - *Considerations*: Requires proper file system permissions setup

- No sensitive data encryption (assumes trusted environment)
  - *Rationale*: Memory banks typically contain project context, not sensitive data
  - *Security*: Assumes deployment in trusted development environments
  - *Future Enhancement*: Could add encryption for sensitive memory banks

- Path traversal prevention mechanisms
  - *Rationale*: Critical security measure for file system access
  - *Implementation*: Multiple validation layers and path normalization
  - *Security*: Multiple defense layers against traversal attacks

## 7. Scalability Considerations

### 7.1 Current Limitations
- Single server deployment model
  - *Rationale*: Simple for individual developers, sufficient for small teams
  - *Limitations*: Single point of failure, limited concurrent processing
  - *Impact*: May become bottleneck with high usage

- File system-based storage (no database)
  - *Rationale*: Simple implementation, familiar to developers
  - *Limitations*: File system performance under high concurrency
  - *Scalability*: Limited by file system I/O capabilities

- No built-in clustering or load balancing
  - *Rationale*: Not needed for target use case (individual/team development)
  - *Limitations*: No horizontal scaling capabilities
  - *Impact*: Performance degrades with high concurrent usage

### 7.2 Potential Improvements
- Database-backed storage for better performance
  - *Rationale*: Databases handle concurrent access better than file systems
  - *Benefits*: Better performance under high load, ACID properties
  - *Considerations*: Increased complexity and deployment requirements

- Caching mechanisms for frequently accessed files
  - *Rationale*: Many memory bank files are read frequently
  - *Benefits*: Reduced file system I/O, faster response times
  - *Implementation*: In-memory cache with TTL and LRU eviction

- API rate limiting and request queuing
  - *Rationale*: Prevents server overload and ensures fair usage
  - *Benefits*: Better resource management, improved reliability
  - *Implementation*: Per-client rate limiting with configurable limits

## 8. Monitoring and Observability

### 8.1 Current State
- Console logging for error reporting
  - *Rationale*: Simple and effective for development and basic monitoring
  - *Benefits*: Easy to implement and view during development
  - *Limitations*: Not suitable for production monitoring at scale

- Standard MCP protocol error handling
  - *Rationale*: Follows MCP specification for error reporting
  - *Benefits*: Consistent error handling for MCP clients
  - *Compliance*: Ensures MCP protocol compatibility

- No built-in metrics or monitoring
  - *Rationale*: Focused on core functionality first
  - *Limitations*: Difficult to monitor performance and usage
  - *Future Enhancement*: Critical for production deployments

### 8.2 Future Enhancements
- Request/response logging
  - *Rationale*: Essential for debugging and monitoring
  - *Benefits*: Track usage patterns and identify issues
  - *Implementation*: Structured logging with request context

- Performance metrics collection
  - *Rationale*: Required for monitoring and optimization
  - *Benefits*: Identify bottlenecks and usage patterns
  - *Implementation*: Response times, error rates, throughput metrics

- Health check endpoints
  - *Rationale*: Required for container orchestration and monitoring
  - *Benefits*: Automated health monitoring and failover
  - *Implementation*: Simple status endpoint with detailed health checks

- Error tracking and alerting
  - *Rationale*: Proactive monitoring of system health
  - *Benefits*: Early detection of issues and performance problems
  - *Implementation*: Integration with monitoring services or self-hosted solutions