import { File } from "../../domain/entities/index.js";

export interface VersionInfo {
  versionId: string;
  timestamp: Date;
  size: number;
}

export interface FileRepository {
  listFiles(projectName: string): Promise<File[]>;
 loadFile(projectName: string, fileName: string): Promise<File | null>;
  writeFile(
    projectName: string,
    fileName: string,
    content: string
  ): Promise<File | null>;
  updateFile(
    projectName: string,
    fileName: string,
    content: string
  ): Promise<File | null>;
  appendFile(
    projectName: string,
    fileName: string,
    content: string
  ): Promise<void>;
  logFile(
    projectName: string,
    fileName: string,
    content: string
  ): Promise<void>;
  listFileVersions(projectName: string, fileName: string): Promise<VersionInfo[]>;
  getFileVersion(projectName: string, fileName: string, versionId: string): Promise<File | null>;
  revertFileVersion(projectName: string, fileName: string, versionId: string): Promise<File | null>;
  cleanupOldVersions(projectName: string, fileName: string, keepLast?: number): Promise<void>;
}
