import { badRequest, ok, serverError } from "../../helpers/index.js";
import { Controller, Request, Response } from "../../protocols/index.js";
import { AppendFileUseCase } from "../../../domain/usecases/append-file.js";
import { Validator } from "../../protocols/validator.js";

export interface AppendFileRequest {
  projectName: string;
  fileName: string;
  content: string;
}

export interface AppendFileResponse {
  message: string;
}

export type AppendFileController = Controller<AppendFileRequest, AppendFileResponse>;

export class AppendFileControllerImpl implements AppendFileController {
  constructor(
    private readonly appendFileUseCase: AppendFileUseCase,
    private readonly validator: Validator
  ) {}

  async handle(request: Request<AppendFileRequest>): Promise<Response<AppendFileResponse>> {
    try {
      const validationError = this.validator.validate(request.body);
      if (validationError) {
        return badRequest(validationError);
      }

      const { projectName, fileName, content } = request.body!;

      await this.appendFileUseCase.appendFile({
        projectName,
        fileName,
        content,
      });

      return ok({ message: "Content appended successfully" });
    } catch (error) {
      return serverError(error as Error);
    }
  }
}