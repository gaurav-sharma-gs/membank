import { FileRepository } from "../../protocols/file-repository.js";
import { ProjectRepository } from "../../protocols/project-repository.js";
import { AppendFileParams, AppendFileUseCase } from "../../../domain/usecases/append-file.js";

export class AppendFile implements AppendFileUseCase {
  constructor(
    private readonly fileRepository: FileRepository,
    private readonly projectRepository: ProjectRepository
  ) {}

  async appendFile(params: AppendFileParams): Promise<void> {
    const { projectName, fileName, content } = params;

    // Ensure project exists (create if it doesn't)
    await this.projectRepository.ensureProject(projectName);

    // Append content to file (creates file if it doesn't exist)
    await this.fileRepository.appendFile(projectName, fileName, content);
  }
}