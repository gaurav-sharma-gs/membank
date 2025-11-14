# Versioning System Design for Memory Bank MCP Server

## Overview

This document analyzes two approaches for implementing file versioning in the Memory Bank MCP Server: timestamp-based file renaming and Git-based versioning. The goal is to provide version history and rollback capabilities while maintaining performance and simplicity.

## Approach 1: Timestamp-Based File Renaming

### Design
- **File Storage**: Each version is stored as a separate file with timestamp in the filename
- **Current File**: Always stored with the original filename
- **Historical Files**: Stored with timestamp suffix (e.g., `file.md.20251114T015000Z`)

### Implementation Details

#### File Structure
```
project-name/
├── current-file.md          # Latest version
├── current-file.md.20251114T014500Z  # Previous version
├── current-file.md.20251114T014000Z  # Earlier version
└── current-file.md.20251114T013500Z # Even earlier version
```

#### Update Operation Flow
1. **Read Current**: Load the current file content
2. **Create Timestamp**: Generate ISO timestamp (e.g., `20251114T015000Z`)
3. **Rename Current**: Move current file to timestamped filename
4. **Write New**: Write new content to original filename
5. **Return**: Return new content with version info
#### Read Operation Flow
1. **Find Latest**: Look for original filename first
2. **Return**: Return content from original filename

#### List Operation Flow
1. **Filter**: Show only files without timestamp suffix in default list
2. **Version List**: Separate API endpoint for listing all versions
### Pros
- **Simplicity**: Easy to understand and implement
- **Performance**: Direct file operations, no complex systems
- **Compatibility**: Works with existing file system storage
- **Flexibility**: Easy to implement version-specific operations
- **Storage**: Predictable storage growth

### Cons
- **Storage**: Multiple copies of similar content
- **No Diffs**: Full file storage, no delta compression
- **Cleanup**: Need to implement version retention policies
- **No Branching**: Linear version history only
- **No Merging**: Cannot merge changes from different versions
- **No Metadata**: Limited version metadata (just timestamp)

## Approach 2: Git-Based Versioning

### Design
- **Git Repository**: Each project directory is a Git repository
- **Commits**: Each update creates a Git commit with timestamp and content
- **Branches**: Potential for feature branches and collaborative work

### Implementation Details
#### Git Operations
```typescript
class GitFileRepository implements FileRepository {
  private git: SimpleGit;
  
  async updateFile(projectName: string, fileName: string, content: string): Promise<File | null> {
    const projectPath = path.join(this.rootDir, projectName);
    const filePath = path.join(projectPath, fileName);
    
    // Write new content
    await fs.writeFile(filePath, content, 'utf-8');
    
    // Add to git
    await this.git.cwd(projectPath);
    await this.git.add(fileName);
    
    // Commit with metadata
    const commitMessage = `Update ${fileName} at ${new Date().toISOString()}`;
    await this.git.commit(commitMessage);
    
    return content;
  }
  
 async listFileVersions(projectName: string, fileName: string): Promise<Version[]> {
    const projectPath = path.join(this.rootDir, projectName);
    await this.git.cwd(projectPath);
    
    const log = await this.git.log({
      file: fileName,
      format: { hash: '%H', date: '%ai', message: '%s' }
    });
    
    return log.all.map(entry => ({
      hash: entry.hash,
      timestamp: entry.date,
      message: entry.message
    }));
  }
}
```

#### Git Repository Structure
```
project-name/
├── .git/                 # Git repository
├── .gitignore           # Ignore unnecessary files
├── file1.md             # Current version of file1
├── file2.md             # Current version of file2
└── ...                  # Other files
```

### Pros
- **Efficient Storage**: Git's delta compression reduces storage
- **Rich History**: Full commit history with metadata
- **Diff Capabilities**: Built-in diff functionality
- **Branching/Merging**: Support for advanced version control
- **Standard Tool**: Git is widely understood and supported
- **Revert/Checkout**: Easy to revert to specific versions
- **Hooks**: Git hooks for automation
### Cons
- **Complexity**: More complex implementation and dependencies
- **Performance**: Git operations may be slower than direct file ops
- **Dependencies**: Requires Git installation on server
- **Learning Curve**: More complex for users unfamiliar with Git
- **Binary Files**: Git less efficient for binary files
- **Repository Size**: Git history can grow large over time

## Comparison Matrix

| Feature | Timestamp Approach | Git Approach |
|---------|-------------------|--------------|
| Implementation Complexity | Simple | Complex |
| Storage Efficiency | Low (full copies) | High (delta compression) |
| Performance | Fast | Moderate |
| Diff Support | No | Yes |
| Branching | No | Yes |
| Merging | No | Yes |
| History Metadata | Basic (timestamp) | Rich (author, message, etc.) |
| Dependencies | None | Git required |
| Learning Curve | Low | High |
| Rollback Capability | Good | Excellent |
| Storage Growth | Linear | Optimized |

## Recommended Approach: Hybrid Solution

Based on the analysis, I recommend a hybrid approach that combines the best of both:

### Phase 1: Timestamp-Based (Immediate Implementation)
- **Start with timestamp approach** for simplicity and quick implementation
- **Add versioning APIs** to existing file operations
- **Implement retention policies** to manage storage

### Phase 2: Git Integration (Future Enhancement)
- **Optional Git backend** for projects that need advanced features
- **Migration path** from timestamp to Git
- **Feature flags** to enable Git for specific projects

## Detailed Timestamp-Based Implementation

### New API Endpoints
1. `list_file_versions(projectName, fileName)` - List all versions of a file
2. `get_file_version(projectName, fileName, versionId)` - Get specific version
3. `revert_file_version(projectName, fileName, versionId)` - Revert to version
4. `get_file_diff(projectName, fileName, version1, version2)` - Get diff between versions

### Version ID Format
- **Timestamp-based**: `YYYYMMDDTHHMMSSZ` (ISO format)
- **Example**: `20251114T01500Z`

### Storage Management
- **Retention Policy**: Keep last N versions (configurable)
- **Auto-cleanup**: Remove oldest versions when limit exceeded
- **Manual Cleanup**: API to remove specific versions

### File Operations with Versioning

#### Update Operation
```typescript
async updateFile(projectName: string, fileName: string, content: string): Promise<File | null> {
  const projectPath = path.join(this.rootDir, projectName);
  const currentPath = path.join(projectPath, fileName);
  
 // Check if current file exists
  if (await fs.pathExists(currentPath)) {
    // Create timestamp for current version
    const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\./g, '').replace('T', 'T');
    const versionPath = `${currentPath}.${timestamp}Z`;
    
    // Move current file to versioned filename
    await fs.move(currentPath, versionPath);
    
    // Clean up old versions (keep last 10)
    await this.cleanupOldVersions(projectName, fileName);
  }
  
 // Write new content to current filename
  await fs.writeFile(currentPath, content, 'utf-8');
  return content;
}
```

#### List Versions Operation
```typescript
async listFileVersions(projectName: string, fileName: string): Promise<VersionInfo[]> {
  const projectPath = path.join(this.rootDir, projectName);
  const currentPath = path.join(projectPath, fileName);
  
 const allFiles = await fs.readdir(projectPath);
  const versionPattern = new RegExp(`^${fileName}\.\d{8}T\d{6}Z$`);
  
  const versions = allFiles
    .filter(file => versionPattern.test(file))
    .map(file => {
      const timestamp = file.replace(`${fileName}.`, '').replace('Z', '');
      return {
        versionId: file,
        timestamp: this.parseTimestamp(timestamp),
        size: // get file size
      };
    })
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  
 return versions;
}
```

## Migration Path

If Git integration is needed later:
1. **Detection**: Identify projects using timestamp versioning
2. **Import**: Import all versions as Git commits
3. **Verification**: Ensure all content is preserved
4. **Switch**: Update repository implementation
5. **Cleanup**: Optionally remove old timestamp files

## Conclusion

For immediate needs, the timestamp-based approach provides the core versioning functionality with minimal complexity. It's simple to implement, maintain, and understand. Git-based approach offers more advanced features but at the cost of complexity. A phased approach starting with timestamp-based versioning allows for gradual enhancement based on actual usage and requirements.