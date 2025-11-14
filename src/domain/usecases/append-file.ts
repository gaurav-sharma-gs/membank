export interface AppendFileParams {
  projectName: string;
  fileName: string;
  content: string;
}

export interface AppendFileUseCase {
  appendFile(params: AppendFileParams): Promise<void>;
}