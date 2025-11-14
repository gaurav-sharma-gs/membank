import { describe, it, expect, vi } from "vitest";
import { RevertFileVersionControllerImpl } from "../../../../src/presentation/controllers/get-file-version/get-file-version-controller.js";
import { GetFileVersionUseCase } from "../../../../src/data/usecases/get-file-version/get-file-version-protocols.js";
import { RevertFileVersionRequest } from "../../../../src/presentation/controllers/get-file-version/protocols.js";
import { Validator } from "../../../../src/presentation/protocols/validator.js";
import { serverError, badRequest, ok, notFound } from "../../../../src/presentation/helpers/index.js";

describe("RevertFileVersion Controller", () => {
  let useCase: GetFileVersionUseCase;
  let validator: Validator;
  let controller: RevertFileVersionControllerImpl;

  const makeSut = () => {
    useCase = {
      getFileVersion: vi.fn(),
      listFileVersions: vi.fn(),
      revertFileVersion: vi.fn(),
    };

    validator = {
      validate: vi.fn(),
    };

    controller = new RevertFileVersionControllerImpl(useCase, validator);

    return { controller, useCase, validator };
  };

  const mockRequest = (data: Partial<RevertFileVersionRequest> = {}): { body?: RevertFileVersionRequest } => ({
    body: {
      projectName: "test-project",
      fileName: "test-file.txt",
      versionId: "20231010T120000Z",
      ...data,
    },
  });

  it("should return 200 on successful file version revert", async () => {
    const { controller, useCase, validator } = makeSut();
    vi.mocked(validator.validate).mockReturnValue(null);
    vi.mocked(useCase.revertFileVersion).mockResolvedValue("reverted content");

    const request = mockRequest();
    const response = await controller.handle(request);

    expect(response).toEqual(ok({ content: "reverted content" }));
    expect(useCase.revertFileVersion).toHaveBeenCalledWith({
      projectName: "test-project",
      fileName: "test-file.txt",
      versionId: "20231010T120000Z",
    });
  });

  it("should return 404 when version to revert does not exist", async () => {
    const { controller, useCase, validator } = makeSut();
    vi.mocked(validator.validate).mockReturnValue(null);
    vi.mocked(useCase.revertFileVersion).mockResolvedValue(null);

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
    vi.mocked(useCase.revertFileVersion).mockRejectedValue(error);

    const request = mockRequest();
    const response = await controller.handle(request);

    expect(response).toEqual(serverError(error));
  });

  it("should call validator.validate with request body", async () => {
    const { controller, validator, useCase } = makeSut();
    vi.mocked(validator.validate).mockReturnValue(null);
    vi.mocked(useCase.revertFileVersion).mockResolvedValue("content");

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