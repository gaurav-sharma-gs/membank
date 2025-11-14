import { describe, it, expect, vi } from "vitest";
import { GetFileVersionControllerImpl } from "../../../../src/presentation/controllers/get-file-version/get-file-version-controller.js";
import { GetFileVersionParams, GetFileVersionUseCase } from "../../../../src/data/usecases/get-file-version/get-file-version-protocols.js";
import { GetFileVersionRequest } from "../../../../src/presentation/controllers/get-file-version/protocols.js";
import { Validator } from "../../../../src/presentation/protocols/validator.js";
import { serverError, badRequest, ok, notFound } from "../../../../src/presentation/helpers/index.js";

describe("GetFileVersion Controller", () => {
  let useCase: GetFileVersionUseCase;
  let validator: Validator;
  let controller: GetFileVersionControllerImpl;

  const makeSut = () => {
    useCase = {
      getFileVersion: vi.fn(),
      listFileVersions: vi.fn(),
      revertFileVersion: vi.fn(),
    };

    validator = {
      validate: vi.fn(),
    };

    controller = new GetFileVersionControllerImpl(useCase, validator);

    return { controller, useCase, validator };
  };

  const mockRequest = (data: Partial<GetFileVersionRequest> = {}): { body?: GetFileVersionRequest } => ({
    body: {
      projectName: "test-project",
      fileName: "test-file.txt",
      versionId: "20231010T120000Z",
      ...data,
    },
  });

  it("should return 200 on successful file version retrieval", async () => {
    const { controller, useCase, validator } = makeSut();
    vi.mocked(validator.validate).mockReturnValue(null);
    vi.mocked(useCase.getFileVersion).mockResolvedValue("file content");

    const request = mockRequest();
    const response = await controller.handle(request);

    expect(response).toEqual(ok({ content: "file content" }));
    expect(useCase.getFileVersion).toHaveBeenCalledWith({
      projectName: "test-project",
      fileName: "test-file.txt",
      versionId: "20231010T120000Z",
    });
  });

  it("should return 404 when file version does not exist", async () => {
    const { controller, useCase, validator } = makeSut();
    vi.mocked(validator.validate).mockReturnValue(null);
    vi.mocked(useCase.getFileVersion).mockResolvedValue(null);

    const request = mockRequest();
    const response = await controller.handle(request);

    expect(response).toEqual(notFound("Version 20231010T120000Z of file test-file.txt in project test-project"));
  });

  it("should return 400 when validation fails", async () => {
    const { controller, validator } = makeSut();
    const validationError = new Error("Validation failed");
    vi.mocked(validator.validate).mockReturnValue(validationError);

    const request = mockRequest({ projectName: "" });
    const response = await controller.handle(request);

    expect(response).toEqual(badRequest(validationError));
  });

  it("should return 500 when use case throws", async () => {
    const { controller, useCase, validator } = makeSut();
    vi.mocked(validator.validate).mockReturnValue(null);
    const error = new Error("Use case error");
    vi.mocked(useCase.getFileVersion).mockRejectedValue(error);

    const request = mockRequest();
    const response = await controller.handle(request);

    expect(response).toEqual(serverError(error));
  });

  it("should call validator.validate with request body", async () => {
    const { controller, validator, useCase } = makeSut();
    vi.mocked(validator.validate).mockReturnValue(null);
    vi.mocked(useCase.getFileVersion).mockResolvedValue("content");

    const request = mockRequest();
    await controller.handle(request);

    expect(validator.validate).toHaveBeenCalledWith(request.body);
  });

  it("should handle missing request body", async () => {
    const { controller, validator } = makeSut();
    vi.mocked(validator.validate).mockReturnValue(null);

    const request = { body: undefined };
    const response = await controller.handle(request);

    expect(validator.validate).toHaveBeenCalledWith(undefined);
  });
});