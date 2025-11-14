# Memory Bank MCP - API Documentation

This document provides comprehensive documentation for the Memory Bank MCP server APIs, including the newly implemented Append and Log APIs.

## Overview

The Memory Bank MCP server provides a set of tools for managing memory bank projects and files. It supports creating, reading, updating, appending, and logging content to files within projects, along with versioning capabilities.

## Available Tools

### 1. list_projects

**Description:** List all projects in the memory bank.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {},
  "required": []
}
```

**Output:** Array of project names.

---

### 2. list_project_files

**Description:** List all files within a specific project.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "projectName": {
      "type": "string",
      "description": "The name of the project"
    }
  },
  "required": ["projectName"]
}
```

**Output:** Array of file names in the project.

---

### 3. memory_bank_read

**Description:** Read a memory bank file for a specific project.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "projectName": {
      "type": "string",
      "description": "The name of the project"
    },
    "fileName": {
      "type": "string",
      "description": "The name of the file"
    }
  },
  "required": ["projectName", "fileName"]
}
```

**Output:** File content as a string.

---

### 4. memory_bank_write

**Description:** Create a new memory bank file for a specific project.

**Input Schema:**
```json
{
  "type": "object",
 "properties": {
    "projectName": {
      "type": "string",
      "description": "The name of the project"
    },
    "fileName": {
      "type": "string",
      "description": "The name of the file"
    },
    "content": {
      "type": "string",
      "description": "The content of the file"
    }
  },
  "required": ["projectName", "fileName", "content"]
}
```

**Output:** Success message confirming file creation.

---

### 5. memory_bank_update

**Description:** Update an existing memory bank file for a specific project with versioning.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "projectName": {
      "type": "string",
      "description": "The name of the project"
    },
    "fileName": {
      "type": "string",
      "description": "The name of the file"
    },
    "content": {
      "type": "string",
      "description": "The content of the file"
    }
  },
  "required": ["projectName", "fileName", "content"]
}
```

**Output:** Updated file content with versioning support.

---

### 6. memory_bank_append

**Description:** Append content to an existing memory bank file for a specific project.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "projectName": {
      "type": "string",
      "description": "The name of the project"
    },
    "fileName": {
      "type": "string",
      "description": "The name of the file"
    },
    "content": {
      "type": "string",
      "description": "The content to append to the file"
    }
  },
  "required": ["projectName", "fileName", "content"]
}
```

**Output:** Success message confirming content was appended.

**Usage Notes:**
- This tool appends content to an existing file with a line break before the new content
- If the file doesn't exist, it will be created with the provided content
- Useful for adding new entries, logs, or data to existing files without overwriting

---

### 7. memory_bank_log

**Description:** Log content to a memory bank file with timestamp for a specific project.

**Input Schema:**
```json
{
  "type": "object",
 "properties": {
    "projectName": {
      "type": "string",
      "description": "The name of the project"
    },
    "fileName": {
      "type": "string",
      "description": "The name of the file"
    },
    "content": {
      "type": "string",
      "description": "The content to log to the file"
    }
  },
  "required": ["projectName", "fileName", "content"]
}
```

**Output:** Success message confirming content was logged.

**Usage Notes:**
- This tool appends content with a timestamp and delimiter to create structured log entries
- Each log entry is formatted as: `=== LOG ENTRY [timestamp] ===\n[content]\n==================`
- Useful for creating audit trails, logs, or timestamped entries
- Creates the file if it doesn't exist

---

### 8. list_file_versions

**Description:** List all versions of a memory bank file.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "projectName": {
      "type": "string",
      "description": "The name of the project"
    },
    "fileName": {
      "type": "string",
      "description": "The name of the file"
    }
  },
  "required": ["projectName", "fileName"]
}
```

**Output:** Array of version information including version ID, timestamp, and size.

---

### 9. get_file_version

**Description:** Get a specific version of a memory bank file.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "projectName": {
      "type": "string",
      "description": "The name of the project"
    },
    "fileName": {
      "type": "string",
      "description": "The name of the file"
    },
    "versionId": {
      "type": "string",
      "description": "The version identifier (timestamp)"
    }
  },
  "required": ["projectName", "fileName", "versionId"]
}
```

**Output:** Content of the specific file version.

---

### 10. revert_file_version

**Description:** Revert a file to a specific version.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "projectName": {
      "type": "string",
      "description": "The name of the project"
    },
    "fileName": {
      "type": "string",
      "description": "The name of the file"
    },
    "versionId": {
      "type": "string",
      "description": "The version identifier (timestamp) to revert to"
    }
 },
  "required": ["projectName", "fileName", "versionId"]
}
```

**Output:** Content of the reverted file.

## Security Features

- **Path Security Validation:** All file and project name parameters are validated to prevent directory traversal attacks
- **Required Field Validation:** All required parameters are validated before processing
- **Input Sanitization:** File paths and project names are sanitized to prevent malicious input

## Best Practices

1. **Use `memory_bank_write`** for creating new files
2. **Use `memory_bank_update`** for updating existing files with versioning support
3. **Use `memory_bank_append`** for adding content to existing files without versioning
4. **Use `memory_bank_log`** for structured logging with timestamps
5. **Use versioning tools** (`list_file_versions`, `get_file_version`, `revert_file_version`) for tracking changes and recovery

## Error Handling

- Invalid parameters return 400 Bad Request
- Missing files/projects return appropriate error responses
- Server errors return 500 Internal Server Error
- All operations include proper error messages for debugging