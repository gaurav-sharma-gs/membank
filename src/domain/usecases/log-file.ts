export interface LogFileParams {
  projectName: string;
  fileName: string;
  content: string;
}

export interface LogFileUseCase {
  logFile(params: LogFileParams): Promise<void>;
}