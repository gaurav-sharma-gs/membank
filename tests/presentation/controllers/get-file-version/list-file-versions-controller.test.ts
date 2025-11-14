import { describe, it, expect, vi } from "vitest";
import { ListFileVersionsControllerImpl } from "../../../../src/presentation/controllers/get-file-version/get-file-version-controller.js";
import { GetFileVersionUseCase } from "../../../../src/data/usecases/get-file-version/get-file-version-protocols.js";
import { ListFileVersionsRequest } from "../../../../src/presentation/controllers/get-file-version/protocols.js";
import { Validator } from "../../../../src/presentation/protocols/validator.js";
import { serverError, badRequest, ok } from "../../../../src/presentation/helpers/index.js";

describe("ListFileVersions Controller", () => {
  let useCase: GetFileVersionUseCase;
  let validator: Validator;
  let controller: ListFileVersionsControllerImpl;

  const makeSut = () => {
    useCase = {
      getFileVersion: vi.fn(),
      listFileVersions: vi.fn(),
      revertFileVersion: vi.fn(),
    };

    validator = {
      validate: vi.fn(),
    };

    controller = new ListFileVersionsControllerImpl(useCase, validator);

    return { controller, useCase, validator };
  };

  const mockRequest = (data: Partial<ListFileVersionsRequest> = {}): { body?: ListFileVersionsRequest } => ({
    body: {
      projectName: "test-project",
      fileName: "test-file.txt",
      ...data,
    },
  });

  it("should return 200 on successful file versions listing", async () => {
    const { controller, useCase, validator } = makeSut();
    const mockVersions = [
      { versionId: "20231010T120000Z", timestamp: new Date(), size: 100 },
      { versionId: "20231009T120000Z", timestamp: new Date(), size: 50 },
    ];
    vi.mocked(validator.validate).mockReturnValue(null);
    vi.mocked(useCase.listFileVersions).mockResolvedValue(mockVersions);

    const request = mockRequest();
    const response = await controller.handle(request);

    expect(response).toEqual(ok({ versions: mockVersions }));
    expect(useCase.listFileVersions).toHaveBeenCalledWith({
      projectName: "test-project",
      fileName: "test-file.txt",
    });
  });

  it("should return empty array when no versions exist", async () => {
    const { controller, useCase, validator } = makeSut();
    vi.mocked(validator.validate).mockReturnValue(null);
    vi.mocked(useCase.listFileVersions).mockResolvedValue([]);

    const request = mockRequest();
    const response = await controller.handle(request);

    expect(response).toEqual(ok({ versions: [] }));
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
    vi.mocked(useCase.listFileVersions).mockRejectedValue(error);

    const request = mockRequest();
    const response = await controller.handle(request);

    expect(response).toEqual(serverError(error));
  });

  it("should call validator.validate with request body", async () => {
    const { controller, validator, useCase } = makeSut();
    vi.mocked(validator.validate).mockReturnValue(null);
    vi.mocked(useCase.listFileVersions).mockResolvedValue([]);

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