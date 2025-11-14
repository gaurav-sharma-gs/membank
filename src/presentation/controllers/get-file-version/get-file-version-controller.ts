import { badRequest, notFound, ok, serverError } from "../../helpers/index.js";
import {
  GetFileVersionController,
  GetFileVersionRequest,
  GetFileVersionResponse,
  ListFileVersionsController,
  ListFileVersionsRequest,
  ListFileVersionsResponse,
  RevertFileVersionController,
  RevertFileVersionRequest,
  RevertFileVersionResponse,
  RequestValidator,
  Request,
  Response
} from "./protocols.js";
import { GetFileVersionUseCase } from "../../../data/usecases/get-file-version/get-file-version-protocols.js";

export class GetFileVersionControllerImpl implements GetFileVersionController {
  constructor(
    private readonly getFileVersionUseCase: GetFileVersionUseCase,
    private readonly validator: RequestValidator
 ) {}

  async handle(request: Request<GetFileVersionRequest>): Promise<Response<GetFileVersionResponse>> {
    try {
      const validationError = this.validator.validate(request.body);
      if (validationError) {
        return badRequest(validationError);
      }

      const { projectName, fileName, versionId } = request.body!;

      const content = await this.getFileVersionUseCase.getFileVersion({
        projectName,
        fileName,
        versionId
      });

      if (content === null) {
        return notFound(`Version ${versionId} of file ${fileName} in project ${projectName}`);
      }

      return ok({ content });
    } catch (error) {
      return serverError(error as Error);
    }
  }
}

export class ListFileVersionsControllerImpl implements ListFileVersionsController {
  constructor(
    private readonly getFileVersionUseCase: GetFileVersionUseCase,
    private readonly validator: RequestValidator
  ) {}

  async handle(request: Request<ListFileVersionsRequest>): Promise<Response<ListFileVersionsResponse>> {
    try {
      const validationError = this.validator.validate(request.body);
      if (validationError) {
        return badRequest(validationError);
      }

      const { projectName, fileName } = request.body!;

      const versions = await this.getFileVersionUseCase.listFileVersions({
        projectName,
        fileName
      });

      return ok({ versions });
    } catch (error) {
      return serverError(error as Error);
    }
  }
}

export class RevertFileVersionControllerImpl implements RevertFileVersionController {
  constructor(
    private readonly getFileVersionUseCase: GetFileVersionUseCase,
    private readonly validator: RequestValidator
 ) {}

  async handle(request: Request<RevertFileVersionRequest>): Promise<Response<RevertFileVersionResponse>> {
    try {
      const validationError = this.validator.validate(request.body);
      if (validationError) {
        return badRequest(validationError);
      }

      const { projectName, fileName, versionId } = request.body!;

      const content = await this.getFileVersionUseCase.revertFileVersion({
        projectName,
        fileName,
        versionId
      });

      if (content === null) {
        return notFound(`Version ${versionId} of file ${fileName} in project ${projectName}`);
      }

      return ok({ content });
    } catch (error) {
      return serverError(error as Error);
    }
  }
}