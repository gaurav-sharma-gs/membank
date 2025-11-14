import { FileRepository } from "../../protocols/file-repository.js";
import { ProjectRepository } from "../../protocols/project-repository.js";
import { LogFileUseCase } from "../../../domain/usecases/log-file.js";

export class LogFile implements LogFileUseCase {
  constructor(
    private readonly fileRepository: FileRepository,
    private readonly projectRepository: ProjectRepository
  ) {}

  async logFile(params: { projectName: string; fileName: string; content: string }): Promise<void> {
    const { projectName, fileName, content } = params;

    // Ensure project exists (create if it doesn't)
    await this.projectRepository.ensureProject(projectName);

    // Log content to file with timestamp and delimiter
    await this.fileRepository.logFile(projectName, fileName, content);
  }
}