import fs from "fs-extra";
import path from "path";
import { FileRepository, VersionInfo } from "../../../data/protocols/file-repository.js";
import { File } from "../../../domain/entities/index.js";

/**
 * Filesystem implementation of the FileRepository protocol
 */
export class FsFileRepository implements FileRepository {
  /**
   * Creates a new FsFileRepository
   * @param rootDir The root directory where all projects are stored
   */
  constructor(private readonly rootDir: string) {}

  /**
   * Lists all files in a project
   * @param projectName The name of the project
   * @returns An array of file names
   */
  async listFiles(projectName: string): Promise<File[]> {
    const projectPath = path.join(this.rootDir, projectName);

    const projectExists = await fs.pathExists(projectPath);
    if (!projectExists) {
      return [];
    }

    const entries = await fs.readdir(projectPath, { withFileTypes: true });
    // Filter out versioned files (those with timestamp suffix) to show only current files
    return entries
      .filter((entry) => entry.isFile() && !this.isVersionedFile(entry.name))
      .map((entry) => entry.name);
  }

  /**
   * Checks if a filename is a versioned file (has timestamp suffix)
   */
  private isVersionedFile(fileName: string): boolean {
    // Pattern: filename.YYYYMMDDTHHMMSSZ
    const versionPattern = /\.\d{8}T\d{6}Z$/;
    return versionPattern.test(fileName);
 }

  /**
   * Gets the base filename without version suffix
   */
  private getBaseFilename(fileName: string): string {
    const versionPattern = /\.\d{8}T\d{6}Z$/;
    return fileName.replace(versionPattern, '');
  }

  /**
   * Loads the content of a file
   * @param projectName The name of the project
   * @param fileName The name of the file
   * @returns The content of the file or null if the file doesn't exist
   */
  async loadFile(
    projectName: string,
    fileName: string
  ): Promise<string | null> {
    const filePath = path.join(this.rootDir, projectName, fileName);

    const fileExists = await fs.pathExists(filePath);
    if (!fileExists) {
      return null;
    }

    const content = await fs.readFile(filePath, "utf-8");
    return content;
 }

  /**
   * Writes a new file
   * @param projectName The name of the project
   * @param fileName The name of the file
   * @param content The content to write
   * @returns The content of the file after writing, or null if the file already exists
   */
  async writeFile(
    projectName: string,
    fileName: string,
    content: string
  ): Promise<File | null> {
    const projectPath = path.join(this.rootDir, projectName);
    await fs.ensureDir(projectPath);

    const filePath = path.join(projectPath, fileName);

    const fileExists = await fs.pathExists(filePath);
    if (fileExists) {
      return null;
    }

    await fs.writeFile(filePath, content, "utf-8");

    return content; // Return the content directly instead of reading from disk
  }

  /**
   * Updates an existing file with versioning
   * @param projectName The name of the project
   * @param fileName The name of the file
   * @param content The new content
   * @returns The content of the file after updating, or null if the file doesn't exist
   */
  async updateFile(
    projectName: string,
    fileName: string,
    content: string
  ): Promise<File | null> {
    const projectPath = path.join(this.rootDir, projectName);
    const filePath = path.join(projectPath, fileName);

    const fileExists = await fs.pathExists(filePath);
    if (!fileExists) {
      return null;
    }

    // Create a version of the current file before updating
    const currentContent = await fs.readFile(filePath, "utf-8");
    const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\./g, '').replace('T', 'T');
    const versionFileName = `${fileName}.${timestamp}Z`;
    const versionFilePath = path.join(projectPath, versionFileName);

    // Move current file to versioned filename
    await fs.writeFile(versionFilePath, currentContent, "utf-8");

    // Write new content to the original file
    await fs.writeFile(filePath, content, "utf-8");

    // Clean up old versions (keep last 10 by default)
    await this.cleanupOldVersions(projectName, fileName);

    return content; // Return the content directly instead of reading from disk
  }

  /**
   * Lists all versions of a file
   * @param projectName The name of the project
   * @param fileName The name of the file
   * @returns Array of version information
   */
  async listFileVersions(projectName: string, fileName: string): Promise<VersionInfo[]> {
    const projectPath = path.join(this.rootDir, projectName);
    const allFiles = await fs.readdir(projectPath);
    
    const versionPattern = new RegExp(`^${fileName}\\.\\d{8}T\\d{6}Z$`);
    
    const versions = allFiles
      .filter(file => versionPattern.test(file))
      .map(async (file) => {
        const versionPath = path.join(projectPath, file);
        const stats = await fs.stat(versionPath);
        const timestampStr = file.replace(`${fileName}.`, '').replace('Z', '');
        const timestamp = this.parseTimestamp(timestampStr);
        
        return {
          versionId: file,
          timestamp,
          size: stats.size
        };
      });

    const resolvedVersions = await Promise.all(versions);
    return resolvedVersions.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Parses timestamp string to Date object
   */
 private parseTimestamp(timestampStr: string): Date {
    // Convert YYYYMMDDTHHMMSS format to ISO format
    const year = timestampStr.substring(0, 4);
    const month = timestampStr.substring(4, 6);
    const day = timestampStr.substring(6, 8);
    const hour = timestampStr.substring(9, 11);
    const minute = timestampStr.substring(11, 13);
    const second = timestampStr.substring(13, 15);
    
    const isoStr = `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
    return new Date(isoStr);
  }

  /**
   * Gets a specific version of a file
   * @param projectName The name of the project
   * @param fileName The name of the file
   * @param versionId The version identifier
   * @returns The content of the specific version or null if not found
   */
  async getFileVersion(projectName: string, fileName: string, versionId: string): Promise<string | null> {
    const projectPath = path.join(this.rootDir, projectName);
    const versionFilePath = path.join(projectPath, versionId);

    const fileExists = await fs.pathExists(versionFilePath);
    if (!fileExists) {
      return null;
    }

    const content = await fs.readFile(versionFilePath, "utf-8");
    return content;
 }

  /**
   * Reverts a file to a specific version
   * @param projectName The name of the project
   * @param fileName The name of the file
   * @param versionId The version identifier to revert to
   * @returns The content of the reverted file or null if not found
   */
  async revertFileVersion(projectName: string, fileName: string, versionId: string): Promise<string | null> {
    const projectPath = path.join(this.rootDir, projectName);
    const versionFilePath = path.join(projectPath, versionId);
    const currentFilePath = path.join(projectPath, fileName);

    const versionExists = await fs.pathExists(versionFilePath);
    if (!versionExists) {
      return null;
    }

    // Get the content of the version to revert to
    const versionContent = await fs.readFile(versionFilePath, "utf-8");

    // Update the current file with the version content (this will create a new version of the current file)
    await this.updateFile(projectName, fileName, versionContent);

    return versionContent;
  }

  /**
   * Appends content to an existing file or creates a new one if it doesn't exist
   * @param projectName The name of the project
   * @param fileName The name of the file
   * @param content The content to append
   */
  async appendFile(
    projectName: string,
    fileName: string,
    content: string
  ): Promise<void> {
    const projectPath = path.join(this.rootDir, projectName);
    await fs.ensureDir(projectPath);

    const filePath = path.join(projectPath, fileName);

    // Add line break before appending new content
    const contentToAppend = `\n${content}`;
    await fs.appendFile(filePath, contentToAppend, "utf-8");
  }

  /**
   * Logs content to a file with timestamp and delimiter
   * @param projectName The name of the project
   * @param fileName The name of the file
   * @param content The content to log
   */
  async logFile(
    projectName: string,
    fileName: string,
    content: string
  ): Promise<void> {
    const projectPath = path.join(this.rootDir, projectName);
    await fs.ensureDir(projectPath);

    const filePath = path.join(projectPath, fileName);

    // Create log entry with timestamp and delimiter
    const timestamp = new Date().toISOString();
    const logEntry = `\n=== LOG ENTRY ${timestamp} ===\n${content}\n==================`;

    await fs.appendFile(filePath, logEntry, "utf-8");
  }

  /**
   * Cleans up old versions of a file, keeping only the most recent ones
   * @param projectName The name of the project
   * @param fileName The name of the file
   * @param keepLast Number of most recent versions to keep (default: 10)
   */
  async cleanupOldVersions(projectName: string, fileName: string, keepLast: number = 10): Promise<void> {
    const projectPath = path.join(this.rootDir, projectName);
    const allFiles = await fs.readdir(projectPath);
    
    const versionPattern = new RegExp(`^${fileName}\\.\\d{8}T\\d{6}Z$`);
    
    const versionFiles = allFiles
      .filter(file => versionPattern.test(file))
      .map(file => {
        const timestampStr = file.replace(`${fileName}.`, '').replace('Z', '');
        return {
          fileName: file,
          timestamp: this.parseTimestamp(timestampStr).getTime()
        };
      })
      .sort((a, b) => b.timestamp - a.timestamp); // Sort by timestamp, newest first

    // Keep the most recent versions and delete the rest
    const filesToDelete = versionFiles.slice(keepLast);
    for (const fileToDelete of filesToDelete) {
      const filePath = path.join(projectPath, fileToDelete.fileName);
      await fs.remove(filePath);
    }
  }
}
