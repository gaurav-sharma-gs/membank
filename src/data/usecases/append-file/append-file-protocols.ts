import { FileRepository } from "../../protocols/file-repository.js";
import { ProjectRepository } from "../../protocols/project-repository.js";

export interface AppendFileParams {
  projectName: string;
  fileName: string;
  content: string;
}

export interface AppendFileUseCase {
  appendFile(params: AppendFileParams): Promise<string | null>;
}

export {
  FileRepository,
  ProjectRepository
};