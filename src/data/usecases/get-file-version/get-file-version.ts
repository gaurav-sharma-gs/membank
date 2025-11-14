import {
  FileRepository,
  ProjectRepository,
  GetFileVersionParams,
  GetFileVersionUseCase,
  VersionInfo
} from "./get-file-version-protocols.js";

export class GetFileVersion implements GetFileVersionUseCase {
  constructor(
    private readonly fileRepository: FileRepository,
    private readonly projectRepository: ProjectRepository
  ) {}

  async getFileVersion(params: GetFileVersionParams): Promise<string | null> {
    const { projectName, fileName, versionId } = params;

    const projectExists = await this.projectRepository.projectExists(projectName);
    if (!projectExists) {
      return null;
    }

    return this.fileRepository.getFileVersion(projectName, fileName, versionId);
  }

  async listFileVersions(params: { projectName: string, fileName: string }): Promise<VersionInfo[]> {
    const { projectName, fileName } = params;

    const projectExists = await this.projectRepository.projectExists(projectName);
    if (!projectExists) {
      return [];
    }

    return this.fileRepository.listFileVersions(projectName, fileName);
 }

  async revertFileVersion(params: GetFileVersionParams): Promise<string | null> {
    const { projectName, fileName, versionId } = params;

    const projectExists = await this.projectRepository.projectExists(projectName);
    if (!projectExists) {
      return null;
    }

    return this.fileRepository.revertFileVersion(projectName, fileName, versionId);
  }
}