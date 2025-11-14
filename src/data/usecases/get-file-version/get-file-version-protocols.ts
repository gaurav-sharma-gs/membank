import { ProjectRepository } from "../../protocols/project-repository.js";
import { FileRepository, VersionInfo } from "../../protocols/file-repository.js";

export interface GetFileVersionParams {
  projectName: string;
  fileName: string;
  versionId: string;
}

export interface GetFileVersionUseCase {
  getFileVersion(params: GetFileVersionParams): Promise<string | null>;
  listFileVersions(params: { projectName: string, fileName: string }): Promise<VersionInfo[]>;
  revertFileVersion(params: GetFileVersionParams): Promise<string | null>;
}

export {
  FileRepository,
  ProjectRepository,
  VersionInfo
};