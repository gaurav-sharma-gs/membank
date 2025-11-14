import { describe, expect, it, vi } from "vitest";
import { AppendFileControllerImpl } from "../../../../src/presentation/controllers/append-file/append-file-controller.js";
import { AppendFileUseCase } from "../../../../src/domain/usecases/append-file.js";
import { UnexpectedError } from "../../../../src/presentation/errors/index.js";
import { makeValidator } from "../../mocks/mock-validator.js";
import { makeAppendFileUseCase } from "../../mocks/mock-append-file-use-case.js";

const makeSut = () => {
  const validatorStub = makeValidator<{ projectName: string; fileName: string; content: string }>();
  const appendFileUseCaseStub = makeAppendFileUseCase();
  const sut = new AppendFileControllerImpl(appendFileUseCaseStub, validatorStub);
  return {
    sut,
    validatorStub,
    appendFileUseCaseStub,
  };
};

describe("AppendFileController", () => {
  it("should call validator with correct values", async () => {
    const { sut, validatorStub } = makeSut();
    const validateSpy = vi.spyOn(validatorStub, "validate");
    const request = {
      body: {
        projectName: "any_project",
        fileName: "any_file",
        content: "any_content",
      },
    };
    await sut.handle(request);
    expect(validateSpy).toHaveBeenCalledWith(request.body);
  });

  it("should return 400 if validator returns an error", async () => {
    const { sut, validatorStub } = makeSut();
    vi.spyOn(validatorStub, "validate").mockReturnValueOnce(
      new Error("any_error")
    );
    const request = {
      body: {
        projectName: "any_project",
        fileName: "any_file",
        content: "any_content",
      },
    };
    const response = await sut.handle(request);
    expect(response).toEqual({
      statusCode: 400,
      body: new Error("any_error"),
    });
  });

  it("should call AppendFileUseCase with correct values", async () => {
    const { sut, appendFileUseCaseStub } = makeSut();
    const appendFileSpy = vi.spyOn(appendFileUseCaseStub, "appendFile");
    const request = {
      body: {
        projectName: "any_project",
        fileName: "any_file",
        content: "any_content",
      },
    };
    await sut.handle(request);
    expect(appendFileSpy).toHaveBeenCalledWith({
      projectName: "any_project",
      fileName: "any_file",
      content: "any_content",
    });
  });

  it("should return 500 if AppendFileUseCase throws", async () => {
    const { sut, appendFileUseCaseStub } = makeSut();
    vi.spyOn(appendFileUseCaseStub, "appendFile").mockRejectedValueOnce(
      new Error("any_error")
    );
    const request = {
      body: {
        projectName: "any_project",
        fileName: "any_file",
        content: "any_content",
      },
    };
    const response = await sut.handle(request);
    expect(response).toEqual({
      statusCode: 500,
      body: new UnexpectedError(new Error("any_error")),
    });
  });

  it("should return 200 if valid data is provided", async () => {
    const { sut } = makeSut();
    const request = {
      body: {
        projectName: "any_project",
        fileName: "any_file",
        content: "any_content",
      },
    };
    const response = await sut.handle(request);
    expect(response).toEqual({
      statusCode: 200,
      body: { message: "Content appended successfully" },
    });
  });
});