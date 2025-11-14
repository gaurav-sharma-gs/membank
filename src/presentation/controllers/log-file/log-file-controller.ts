import { badRequest, ok, serverError } from "../../helpers/index.js";
import { Controller, Request, Response } from "../../protocols/index.js";
import { LogFileUseCase } from "../../../domain/usecases/log-file.js";
import { Validator } from "../../protocols/validator.js";

export interface LogFileRequest {
  projectName: string;
  fileName: string;
 content: string;
}

export interface LogFileResponse {
  message: string;
}

export type LogFileController = Controller<LogFileRequest, LogFileResponse>;

export class LogFileControllerImpl implements LogFileController {
  constructor(
    private readonly logFileUseCase: LogFileUseCase,
    private readonly validator: Validator
 ) {}

  async handle(request: Request<LogFileRequest>): Promise<Response<LogFileResponse>> {
    try {
      const validationError = this.validator.validate(request.body);
      if (validationError) {
        return badRequest(validationError);
      }

      const { projectName, fileName, content } = request.body!;

      await this.logFileUseCase.logFile({
        projectName,
        fileName,
        content,
      });

      return ok({ message: "Content logged successfully" });
    } catch (error) {
      return serverError(error as Error);
    }
  }
}