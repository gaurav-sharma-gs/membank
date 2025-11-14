import { FileRepository, VersionInfo } from "../../../data/protocols/file-repository.js";
import { FsFileRepository } from "./fs-file-repository.js";

interface CacheEntry {
  content: string;
  timestamp: number;
}

export class CachedFileRepository implements FileRepository {
  private cache: Map<string, CacheEntry> = new Map();
  private readonly cacheTTL: number = 30 * 60 * 1000; // 30 minutes TTL

 constructor(private readonly fileRepository: FsFileRepository) {}

  private generateCacheKey(projectName: string, fileName: string): string {
    return `${projectName}/${fileName}`;
  }

  private isCacheValid(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp < this.cacheTTL;
  }

 private invalidateCache(projectName: string, fileName: string): void {
    const key = this.generateCacheKey(projectName, fileName);
    this.cache.delete(key);
  }

  private invalidateProjectCache(projectName: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(projectName + "/")) {
        this.cache.delete(key);
      }
    }
  }

  private invalidateVersionCache(projectName: string, fileName: string): void {
    // Invalidate all versioned files for this specific file
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${projectName}/${fileName}.`) && key.includes('.Z')) {
        // This is a versioned file (has timestamp suffix like .YYYYMMDDTHHMMSSZ)
        this.cache.delete(key);
      }
    }
  }

  async listFiles(projectName: string): Promise<string[]> {
    // Don't cache directory listings as they can change frequently
    // But invalidate cache for the project since file list might change
    this.invalidateProjectCache(projectName);
    return await this.fileRepository.listFiles(projectName);
  }

  async loadFile(projectName: string, fileName: string): Promise<string | null> {
    const key = this.generateCacheKey(projectName, fileName);
    const cached = this.cache.get(key);

    if (cached && this.isCacheValid(cached)) {
      return cached.content;
    }

    const content = await this.fileRepository.loadFile(projectName, fileName);
    
    if (content !== null) {
      this.cache.set(key, {
        content,
        timestamp: Date.now(),
      });
    } else {
      // If file doesn't exist, remove from cache to avoid stale entries
      this.cache.delete(key);
    }

    return content;
  }

  async writeFile(projectName: string, fileName: string, content: string): Promise<string | null> {
    // Invalidate cache before writing to ensure consistency
    this.invalidateCache(projectName, fileName);
    
    const result = await this.fileRepository.writeFile(projectName, fileName, content);
    
    // Note: We don't populate cache here to ensure next read goes to source of truth
    // Cache will be populated on next loadFile call

    return result;
  }

  async updateFile(projectName: string, fileName: string, content: string): Promise<string | null> {
    // Invalidate cache before updating to ensure consistency
    // Also invalidate any versioned file caches for this file
    this.invalidateCache(projectName, fileName);
    this.invalidateVersionCache(projectName, fileName);
    
    const result = await this.fileRepository.updateFile(projectName, fileName, content);
    
    // Note: We don't populate cache here to ensure next read goes to source of truth
    // Cache will be populated on next loadFile call

    return result;
  }

  async listFileVersions(projectName: string, fileName: string): Promise<VersionInfo[]> {
    // Don't cache version lists as they change frequently with updates
    return await this.fileRepository.listFileVersions(projectName, fileName);
 }

  async getFileVersion(projectName: string, fileName: string, versionId: string): Promise<string | null> {
    // Versioned files have their own unique names, so we can cache them separately
    const key = this.generateCacheKey(projectName, versionId);
    const cached = this.cache.get(key);

    if (cached && this.isCacheValid(cached)) {
      return cached.content;
    }

    const content = await this.fileRepository.getFileVersion(projectName, fileName, versionId);
    
    if (content !== null) {
      this.cache.set(key, {
        content,
        timestamp: Date.now(),
      });
    }

    return content;
  }

  async revertFileVersion(projectName: string, fileName: string, versionId: string): Promise<string | null> {
    // Invalidate cache for the main file and the specific version being reverted to
    this.invalidateCache(projectName, fileName);
    const versionKey = this.generateCacheKey(projectName, versionId);
    this.cache.delete(versionKey);
    
    const result = await this.fileRepository.revertFileVersion(projectName, fileName, versionId);
    
    // Note: We don't populate cache here to ensure next read goes to source of truth
    // Cache will be populated on next loadFile call

    return result;
  }

  async appendFile(
    projectName: string,
    fileName: string,
    content: string
  ): Promise<void> {
    // Invalidate cache before appending to ensure consistency
    this.invalidateCache(projectName, fileName);
    
    await this.fileRepository.appendFile(projectName, fileName, content);
  }

  async logFile(
    projectName: string,
    fileName: string,
    content: string
 ): Promise<void> {
    // Invalidate cache before logging to ensure consistency
    this.invalidateCache(projectName, fileName);
    
    await this.fileRepository.logFile(projectName, fileName, content);
  }

  async cleanupOldVersions(projectName: string, fileName: string, keepLast?: number): Promise<void> {
    // This operation affects the file system directly, so we should invalidate related caches
    this.invalidateProjectCache(projectName);
    this.invalidateVersionCache(projectName, fileName);
    await this.fileRepository.cleanupOldVersions(projectName, fileName, keepLast);
  }
}