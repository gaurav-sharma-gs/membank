import { describe, it, expect, vi } from "vitest";
import { LogFileControllerImpl, LogFileRequest } from "../../../../src/presentation/controllers/log-file/log-file-controller.js";
import { LogFileUseCase } from "../../../../src/domain/usecases/log-file.js";
import { Validator } from "../../../../src/presentation/protocols/validator.js";
import { serverError, badRequest, ok } from "../../../../src/presentation/helpers/index.js";

describe("LogFile Controller", () => {
  let useCase: LogFileUseCase;
  let validator: Validator;
  let controller: LogFileControllerImpl;

  const makeSut = () => {
    useCase = {
      logFile: vi.fn(),
    };

    validator = {
      validate: vi.fn(),
    };

    controller = new LogFileControllerImpl(useCase, validator);

    return { controller, useCase, validator };
  };

  const mockRequest = (data: Partial<LogFileRequest> = {}): { body?: LogFileRequest } => ({
    body: {
      projectName: "test-project",
      fileName: "test-file.txt",
      content: "Test content",
      ...data,
    },
  });

  it("should return 200 on successful log", async () => {
    const { controller, useCase, validator } = makeSut();
    vi.mocked(validator.validate).mockReturnValue(null);
    vi.mocked(useCase.logFile).mockResolvedValue();

    const request = mockRequest();
    const response = await controller.handle(request);

    expect(response).toEqual(ok({ message: "Content logged successfully" }));
    expect(useCase.logFile).toHaveBeenCalledWith({
      projectName: "test-project",
      fileName: "test-file.txt",
      content: "Test content",
    });
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
    vi.mocked(useCase.logFile).mockRejectedValue(error);

    const request = mockRequest();
    const response = await controller.handle(request);

    expect(response).toEqual(serverError(error));
  });

  it("should call validator.validate with request body", async () => {
    const { controller, validator } = makeSut();
    vi.mocked(validator.validate).mockReturnValue(null);
    vi.mocked(useCase.logFile).mockResolvedValue();

    const request = mockRequest();
    await controller.handle(request);

    expect(validator.validate).toHaveBeenCalledWith(request.body);
  });

  it("should handle missing request body", async () => {
    const { controller, validator } = makeSut();
    vi.mocked(validator.validate).mockReturnValue(null);
    vi.mocked(useCase.logFile).mockResolvedValue();

    const request = { body: undefined };
    const response = await controller.handle(request);

    // This will likely fail validation since required fields are missing
    expect(validator.validate).toHaveBeenCalledWith(undefined);
  });
});