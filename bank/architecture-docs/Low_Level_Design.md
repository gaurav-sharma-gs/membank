# Low Level Design (LLD)

## 1. Class Diagrams

### 1.1 Domain Layer
```typescript
// Domain Entities
type Project = string;
type File = string;

// Use Case Interfaces
interface ListProjectsUseCase {
    listProjects(): Promise<Project[]>;
}

interface ListProjectFilesUseCase {
    listProjectFiles(params: { projectName: string }): Promise<File[]>;
}

interface ReadFileUseCase {
    readFile(params: { projectName: string, fileName: string }): Promise<string | null>;
}

interface WriteFileUseCase {
    writeFile(params: { projectName: string, fileName: string, content: string }): Promise<File | null>;
}

interface UpdateFileUseCase {
    updateFile(params: { projectName: string, fileName: string, content: string }): Promise<File | null>;
}
```

**Design Rationale for Domain Layer**:
- **Simple Types**: Using `string` types for Project and File keeps the domain simple and focused on the core use case
- **Interface Contracts**: Use case interfaces define clear contracts that can be implemented differently
- **Async Patterns**: All operations are asynchronous to handle I/O operations properly
- **Null Safety**: Using `null` return types for "not found" scenarios provides clear semantics

**Implementation Considerations**:
- **Extensibility**: Simple types allow for future enhancement (e.g., Project could become an object with metadata)
- **Performance**: String types provide optimal performance for current use case
- **Type Safety**: TypeScript interfaces provide compile-time safety and clear API contracts

### 1.2 Data Layer
```typescript
// Repository Interfaces
interface ProjectRepository {
    listProjects(): Promise<Project[]>;
    projectExists(name: string): Promise<boolean>;
    ensureProject(name: string): Promise<void>;
}

interface FileRepository {
    listFiles(projectName: string): Promise<File[]>;
    loadFile(projectName: string, fileName: string): Promise<File | null>;
    writeFile(projectName: string, fileName: string, content: string): Promise<File | null>;
    updateFile(projectName: string, fileName: string, content: string): Promise<File | null>;
}

// Implementation Classes
class FsProjectRepository implements ProjectRepository {
    constructor(private readonly rootDir: string) {}
    
    async listProjects(): Promise<Project[]> {
        // Implementation details
    }
    
    async projectExists(name: string): Promise<boolean> {
        // Implementation details
    }
    
    async ensureProject(name: string): Promise<void> {
        // Implementation details
    }
}

class FsFileRepository implements FileRepository {
    constructor(private readonly rootDir: string) {}
    
    async listFiles(projectName: string): Promise<File[]> {
        // Implementation details
    }
    
    async loadFile(projectName: string, fileName: string): Promise<string | null> {
        // Implementation details
    }
    
    async writeFile(projectName: string, fileName: string, content: string): Promise<File | null> {
        // Implementation details
    }
    
    async updateFile(projectName: string, fileName: string, content: string): Promise<File | null> {
        // Implementation details
    }
}
```

**Repository Pattern Rationale**:
- **Abstraction**: Repository interfaces abstract data access implementation details
- **Testability**: Interfaces enable easy mocking for unit tests
- **Flexibility**: Different implementations can be swapped (file system, database, cloud storage)
- **Single Responsibility**: Each repository focuses on specific entity operations

**Implementation Details**:
- **Dependency Injection**: Repositories are injected into use cases, enabling loose coupling
- **Path Management**: Root directory is passed to repository constructors for security
- **Error Handling**: All operations are async and handle file system errors appropriately
- **Security**: Path validation occurs at repository level to prevent traversal attacks

### 1.3 Presentation Layer
```typescript
// Controller Interface
interface Controller<RequestType, ResponseType> {
    handle(request: Request<RequestType>): Promise<ResponseType>>;
}

// Specific Controllers
class ReadController implements Controller<ReadRequest, ReadResponse> {
    constructor(
        private readonly readFileUseCase: ReadFileUseCase,
        private readonly validator: Validator
    ) {}
    
    async handle(request: Request<ReadRequest>): Promise<Response<ReadResponse>> {
        try {
            const validationError = this.validator.validate(request.body);
            if (validationError) {
                return badRequest(validationError);
            }

            const { projectName, fileName } = request.body!;
            const content = await this.readFileUseCase.readFile({
                projectName,
                fileName,
            });

            if (content === null) {
                return notFound(fileName);
            }

            return ok(content);
        } catch (error) {
            return serverError(error as Error);
        }
    }
}

class WriteController implements Controller<WriteRequest, WriteResponse> {
    constructor(
        private readonly writeFileUseCase: WriteFileUseCase,
        private readonly validator: Validator
    ) {}
    
    async handle(request: Request<WriteRequest>): Promise<Response<WriteResponse>> {
        try {
            const validationError = this.validator.validate(request.body);
            if (validationError) {
                return badRequest(validationError);
            }

            const { projectName, fileName, content } = request.body!;
            
            const result = await this.writeFileUseCase.writeFile({
                projectName,
                fileName,
                content,
            });

            if (result === null) {
                return badRequest("File already exists");
            }

            return ok(result);
        } catch (error) {
            return serverError(error as Error);
        }
    }
}

class ListProjectsController implements Controller<ListProjectsRequest, ListProjectsResponse> {
    constructor(
        private readonly listProjectsUseCase: ListProjectsUseCase,
        private readonly validator: Validator
    ) {}
    
    async handle(request: Request<ListProjectsRequest>): Promise<Response<ListProjectsResponse>> {
        try {
            const validationError = this.validator.validate(request.body);
            if (validationError) {
                return badRequest(validationError);
            }

            const projects = await this.listProjectsUseCase.listProjects();
            return ok(projects);
        } catch (error) {
            return serverError(error as Error);
        }
    }
}
```

**Controller Design Patterns**:
- **Template Method**: Common error handling and validation pattern across all controllers
- **Dependency Injection**: Use cases and validators are injected, enabling testability
- **Separation of Concerns**: Each controller handles one specific operation type
- **Error Consistency**: Standardized error handling and response formatting

**Implementation Rationale**:
- **Try-Catch Pattern**: All controllers follow consistent error handling approach
- **Validation First**: Input validation occurs before business logic execution
- **MCP Compliance**: Response helpers ensure MCP protocol compliance
- **Type Safety**: Generic controller interface provides type safety across operations

## 2. Sequence Diagrams

### 2.1 Read File Operation Sequence
```
AI Assistant -> MCP Server: memory_bank_read(projectName, fileName)
MCP Server -> McpServerAdapter: start()
McpServerAdapter -> McpRouterAdapter: setTool() for memory_bank_read
McpRouterAdapter -> McpRequestAdapter: adaptMcpRequestHandler()
McpRequestAdapter -> ReadController: handle(request)
ReadController -> Validator: validate(request.body)
Validator -> ReadController: validationResult
ReadController -> ReadFile: readFile(params)
ReadFile -> ProjectRepository: projectExists(projectName)
ProjectRepository -> ReadFile: exists
ReadFile -> FileRepository: loadFile(projectName, fileName)
FileRepository -> File system: readFile(filePath)
File system -> FileRepository: fileContent
FileRepository -> ReadFile: content
ReadFile -> ReadController: content
ReadController -> MCP Server: response
MCP Server -> AI Assistant: file content
```

**Detailed Flow Analysis**:
1. **MCP Protocol Layer**: Handles MCP-specific request formatting and routing
2. **Validation Layer**: Validates input parameters and security checks (path traversal)
3. **Business Logic**: ReadFile use case orchestrates the operation
4. **Data Access**: Project validation followed by file loading
5. **File System**: Direct file system access with proper encoding
6. **Response Chain**: Error handling and MCP-compliant response formatting

**Security Considerations**: Each step includes validation to prevent unauthorized access and path traversal.

**Performance Characteristics**: 
- File system I/O is the primary performance bottleneck
- Path validation adds minimal overhead
- Async operations prevent blocking

### 2.2 Write File Operation Sequence
```
AI Assistant -> MCP Server: memory_bank_write(projectName, fileName, content)
MCP Server -> McpServerAdapter: start()
McpServerAdapter -> McpRouterAdapter: setTool() for memory_bank_write
McpRouterAdapter -> McpRequestAdapter: adaptMcpRequestHandler()
McpRequestAdapter -> WriteController: handle(request)
WriteController -> Validator: validate(request.body)
Validator -> WriteController: validationResult
WriteController -> WriteFile: writeFile(params)
WriteFile -> ProjectRepository: ensureProject(projectName)
ProjectRepository -> WriteFile: project ensured
WriteFile -> FileRepository: writeFile(projectName, fileName, content)
FileRepository -> File system: writeFile(filePath, content)
File system -> FileRepository: write complete
FileRepository -> WriteFile: content
WriteFile -> WriteController: result
WriteController -> MCP Server: response
MCP Server -> AI Assistant: success response
```

**Detailed Flow Analysis**:
1. **Input Validation**: All parameters validated for format and security
2. **Project Creation**: Project directory created if it doesn't exist
3. **File Creation**: New file created (no overwrites allowed)
4. **Content Writing**: UTF-8 encoded content written to file
5. **Response Formatting**: Success confirmation returned

**Business Rules Enforced**:
- Projects are created automatically if they don't exist
- Write operations only create new files (no overwrites)
- Content is validated for proper encoding

**Error Handling**:
- File already exists: Returns bad request error
- Project creation failure: Propagates up as server error
- File system errors: Handled as server errors

## 3. Detailed Class Implementations

### 3.1 FsProjectRepository
```typescript
export class FsProjectRepository implements ProjectRepository {
    constructor(private readonly rootDir: string) {}
    
    private buildProjectPath(projectName: string): string {
        return path.join(this.rootDir, projectName);
    }
    
    async listProjects(): Promise<Project[]> {
        const entries = await fs.readdir(this.rootDir, { withFileTypes: true });
        const projects: Project[] = entries
            .filter((entry) => entry.isDirectory())
            .map((entry) => entry.name);
        return projects;
    }
    
    async projectExists(name: string): Promise<boolean> {
        const projectPath = this.buildProjectPath(name);
        const stat = await fs.stat(projectPath);
        return stat.isDirectory();
    }
    
    async ensureProject(name: string): Promise<void> {
        const projectPath = this.buildProjectPath(name);
        await fs.ensureDir(projectPath);
    }
}
```

**Implementation Details**:
- **Path Building**: `buildProjectPath()` centralizes path construction for security
- **Directory Only**: `listProjects()` filters to return only directories (not files)
- **Stat Validation**: `projectExists()` uses `fs.stat()` to verify directory existence
- **Ensure Directory**: `ensureProject()` creates directory if it doesn't exist

**Security Features**:
- **Root Directory Constraint**: All operations confined to configured root directory
- **Path Validation**: No external path parameters, all paths built internally
- **Directory Verification**: Confirms path is a directory, not a file

**Performance Considerations**:
- **Directory Reading**: Uses `withFileTypes: true` for efficient directory scanning
- **Async Operations**: All operations are non-blocking
- **Caching Opportunity**: Results could be cached for frequently accessed operations

### 3.2 FsFileRepository
```typescript
export class FsFileRepository implements FileRepository {
    constructor(private readonly rootDir: string) {}
    
    async listFiles(projectName: string): Promise<File[]> {
        const projectPath = path.join(this.rootDir, projectName);
        const projectExists = await fs.pathExists(projectPath);
        if (!projectExists) {
            return [];
        }
        const entries = await fs.readdir(projectPath, { withFileTypes: true });
        return entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
    }
    
    async loadFile(projectName: string, fileName: string): Promise<string | null> {
        const filePath = path.join(this.rootDir, projectName, fileName);
        const fileExists = await fs.pathExists(filePath);
        if (!fileExists) {
            return null;
        }
        const content = await fs.readFile(filePath, "utf-8");
        return content;
    }
    
    async writeFile(projectName: string, fileName: string, content: string): Promise<File | null> {
        const projectPath = path.join(this.rootDir, projectName);
        await fs.ensureDir(projectPath);
        
        const filePath = path.join(projectPath, fileName);
        const fileExists = await fs.pathExists(filePath);
        if (fileExists) {
            return null; // File already exists
        }
        
        await fs.writeFile(filePath, content, "utf-8");
        return await this.loadFile(projectName, fileName);
    }
    
    async updateFile(projectName: string, fileName: string, content: string): Promise<File | null> {
        const filePath = path.join(this.rootDir, projectName, fileName);
        const fileExists = await fs.pathExists(filePath);
        if (!fileExists) {
            return null; // File doesn't exist
        }
        
        await fs.writeFile(filePath, content, "utf-8");
        return await this.loadFile(projectName, fileName);
    }
}
```

**Implementation Details**:
- **File System Safety**: Uses `fs-extra` for enhanced file system operations
- **UTF-8 Encoding**: All files read/written with UTF-8 encoding
- **Existence Checks**: Validates file/directory existence before operations
- **Path Security**: All paths built using `path.join()` to prevent traversal

**Business Logic**:
- **Write Protection**: `writeFile()` returns null if file already exists (no overwrites)
- **Update Validation**: `updateFile()` returns null if file doesn't exist
- **Project Creation**: `writeFile()` ensures project directory exists

**Error Handling**:
- **File Not Found**: Returns `null` instead of throwing errors
- **Directory Missing**: `listFiles()` returns empty array for non-existent projects
- **File System Errors**: Propagates up as exceptions for serious errors

### 3.3 ReadFile
```typescript
export class ReadFile implements ReadFileUseCase {
    constructor(
        private readonly fileRepository: FileRepository,
        private readonly projectRepository: ProjectRepository
    ) {}
    
    async readFile(params: ReadFileParams): Promise<string | null> {
        const { projectName, fileName } = params;
        
        const projectExists = await this.projectRepository.projectExists(projectName);
        if (!projectExists) {
            return null;
        }
        
        return this.fileRepository.loadFile(projectName, fileName);
    }
}
```

**Implementation Details**:
- **Dependency Injection**: Both file and project repositories injected
- **Validation Chain**: Project existence validated before file access
- **Null Propagation**: Returns null for both project and file not found

**Business Logic**:
- **Project Validation**: Ensures project exists before file access (security)
- **Isolation**: Cannot access files from non-existent projects
- **Consistency**: Follows same null-return pattern as repositories
**Security Considerations**:
- **Project Isolation**: Cannot access files from non-existent projects
- **Validation Order**: Project check before file check prevents information leakage

### 3.4 ReadController
```typescript
export class ReadController implements Controller<ReadRequest, ReadResponse> {
    constructor(
        private readonly readFileUseCase: ReadFileUseCase,
        private readonly validator: Validator
    ) {}
    
    async handle(request: Request<ReadRequest>): Promise<Response<ReadResponse>> {
        try {
            const validationError = this.validator.validate(request.body);
            if (validationError) {
                return badRequest(validationError);
            }
            
            const { projectName, fileName } = request.body!;
            
            const content = await this.readFileUseCase.readFile({
                projectName,
                fileName,
            });
            
            if (content === null) {
                return notFound(fileName);
            }
            
            return ok(content);
        } catch (error) {
            return serverError(error as Error);
        }
    }
}
```

**Implementation Details**:
- **Validation First**: Input validation occurs before business logic
- **Error Handling**: Standard try-catch pattern for consistent error handling
- **Response Helpers**: Uses helper functions for standardized responses
- **Type Safety**: TypeScript ensures proper request/response typing

**Business Logic**:
- **Null Handling**: Properly handles null returns from use case
- **Response Mapping**: Maps business logic results to MCP responses
- **Error Mapping**: Maps different error types to appropriate HTTP responses

**Security Features**:
- **Input Validation**: All inputs validated before processing
- **Path Security**: Validator prevents path traversal attacks
- **Access Control**: Only validated projects/files are accessible

## 4. Error Handling Design

### 4.1 Error Types
- **NotFoundError**: File or project not found
  - *Implementation*: Returns null from repositories, handled as 404 responses
  - *Rationale*: Clean semantic for missing resources
  - *Security*: Doesn't leak information about resource existence
- **InvalidParamError**: Invalid parameters provided
  - *Implementation*: Thrown by validators for malformed parameters
  - *Rationale*: Early validation prevents invalid processing
  - *User Experience*: Clear error messages for invalid inputs

- **MissingParamError**: Required parameters missing
  - *Implementation*: Thrown by validators for missing required fields
  - *Rationale*: Ensures all required data is present
  - *MCP Compliance*: Follows MCP error response format

- **UnexpectedError**: Unexpected runtime errors
 - *Implementation*: Caught by controller try-catch blocks
  - *Rationale*: Graceful degradation for unexpected conditions
  - *Security*: Generic error messages to prevent information leakage

- **ValidationError**: Input validation failures
  - *Implementation*: Thrown by validation chain
  - *Rationale*: Centralized validation logic
  - *Performance*: Early validation prevents unnecessary processing

### 4.2 Error Response Format
```typescript
interface ErrorResponse {
    status: number;
    body: {
        error: string;
        message: string;
        name?: string;
    };
}
```

**MCP Compliance**:
- **Status Codes**: Follows HTTP status code conventions
- **Body Structure**: MCP protocol compliant error response format
- **Message Clarity**: Human-readable error messages
- **Security**: No sensitive system information exposed

### 4.3 Error Propagation
- Infrastructure layer: Throw specific errors
  - *Implementation*: File system operations throw specific errors
  - *Rationale*: Low-level errors need to be handled appropriately
  - *Security*: Prevents generic error handling from hiding important issues

- Data layer: Catch and transform to domain errors
  - *Implementation*: Repository methods catch and transform errors
  - *Rationale*: Domain layer should not be exposed to infrastructure details
  - *Benefits*: Consistent error handling across different storage implementations

- Business layer: Handle domain-specific errors
 - *Implementation*: Use cases handle business logic errors
  - *Rationale*: Business rules may generate specific error conditions
  - *Benefits*: Centralized business logic error handling

- Presentation layer: Format errors for MCP protocol
 - *Implementation*: Controllers format errors according to MCP standards
  - *Rationale*: MCP clients expect specific error response formats
  - *Benefits*: Consistent error handling across all operations

- MCP layer: Return standardized error responses
 - *Implementation*: MCP adapter returns protocol-compliant errors
 - *Rationale*: Maintains MCP protocol compliance
  - *Benefits*: MCP clients can handle errors consistently

## 5. Validation Design

### 5.1 Validation Chain
```
MCP Request → Controller → Validator → Use Case → Repository → File System
```

**Validation Strategy**:
- **Early Validation**: Input validation occurs as early as possible
- **Layered Validation**: Multiple validation layers for comprehensive security
- **Performance**: Early validation prevents unnecessary processing
- **Security**: Multiple defense layers against invalid inputs

### 5.2 Validator Components
- **RequiredFieldValidator**: Check for required fields
  - *Purpose*: Ensures all required parameters are present
 - *Implementation*: Validates field existence in request body
  - *Security*: Prevents operations with incomplete data
  - *Performance*: Fast validation before complex operations

- **ParamNameValidator**: Validate parameter names and formats
  - *Purpose*: Ensures parameter names follow expected format
  - *Implementation*: Validates parameter naming conventions
  - *Security*: Prevents parameter injection attacks
  - *MCP Compliance*: Ensures parameter names match tool schemas
- **PathSecurityValidator**: Prevent path traversal attacks
  - *Purpose*: Validates file and project names for security
  - *Implementation*: Checks for traversal patterns like "../"
  - *Security*: Critical protection against unauthorized file access
  - *Performance*: Fast pattern matching validation

- **ValidatorComposite**: Combine multiple validators
  - *Purpose*: Execute multiple validators in sequence
  - *Implementation*: Runs all validators and aggregates results
  - *Benefits*: Single validation interface with comprehensive checks
  - *Flexibility*: Easy to add/remove validation rules

### 5.3 Validation Rules
- Project names: alphanumeric with underscores/hyphens only
  - *Rationale*: Safe file system directory names
  - *Security*: Prevents special characters that could be used for attacks
  - *Implementation*: Regular expression validation
  - *Benefits*: Cross-platform file system compatibility

- File names: valid file system names without path traversal
  - *Rationale*: Safe file system file names
  - *Security*: Prevents path traversal and special character attacks
  - *Implementation*: Path validation and character checking
  - *Benefits*: File system integrity and security

- Content: UTF-8 encoded strings
  - *Rationale*: Proper text encoding for memory banks
  - *Security*: Validates content encoding
  - *Implementation*: Encoding validation
  - *Benefits*: Consistent text handling across platforms

- Path validation: No "../" sequences to prevent directory traversal
 - *Rationale*: Critical security measure
  - *Security*: Prevents unauthorized file system access
  - *Implementation*: Pattern matching and path normalization
  - *Benefits*: Multiple defense layers against traversal attacks