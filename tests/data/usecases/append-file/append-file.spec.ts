import { beforeEach, describe, expect, test, vi } from "vitest";
import { FileRepository } from "../../../../src/data/protocols/file-repository.js";
import { ProjectRepository } from "../../../../src/data/protocols/project-repository.js";
import { AppendFile } from "../../../../src/data/usecases/append-file/append-file.js";
import { MockFileRepository, MockProjectRepository } from "../../mocks/index.js";

describe("AppendFile UseCase", () => {
  let sut: AppendFile;
  let fileRepositoryStub: FileRepository;
  let projectRepositoryStub: ProjectRepository;

  beforeEach(() => {
    fileRepositoryStub = new MockFileRepository();
    projectRepositoryStub = new MockProjectRepository();
    sut = new AppendFile(fileRepositoryStub, projectRepositoryStub);
  });

  test("should call ProjectRepository.ensureProject with correct projectName", async () => {
    const ensureProjectSpy = vi.spyOn(projectRepositoryStub, "ensureProject");
    const params = {
      projectName: "test-project",
      fileName: "test-file.txt",
      content: "test content",
    };

    await sut.appendFile(params);

    expect(ensureProjectSpy).toHaveBeenCalledWith("test-project");
  });

  test("should call FileRepository.appendFile with correct params", async () => {
    const appendFileSpy = vi.spyOn(fileRepositoryStub, "appendFile");
    const params = {
      projectName: "test-project",
      fileName: "test-file.txt",
      content: "test content",
    };

    await sut.appendFile(params);

    expect(appendFileSpy).toHaveBeenCalledWith(
      "test-project",
      "test-file.txt",
      "test content"
    );
 });

  test("should ensure project exists before appending file", async () => {
    const ensureProjectSpy = vi.spyOn(projectRepositoryStub, "ensureProject");
    const appendFileSpy = vi.spyOn(fileRepositoryStub, "appendFile");
    const params = {
      projectName: "test-project",
      fileName: "test-file.txt",
      content: "test content",
    };

    await sut.appendFile(params);

    expect(ensureProjectSpy).toHaveBeenCalledBefore(appendFileSpy);
  });

  test("should throw if repository throws", async () => {
    const error = new Error("Repository error");
    vi.spyOn(projectRepositoryStub, "ensureProject").mockRejectedValueOnce(
      error
    );
    const params = {
      projectName: "test-project",
      fileName: "test-file.txt",
      content: "test content",
    };

    await expect(sut.appendFile(params)).rejects.toThrow(error);
  });

  test("should return undefined on successful append", async () => {
    const params = {
      projectName: "test-project",
      fileName: "test-file.txt",
      content: "test content",
    };

    const result = await sut.appendFile(params);

    expect(result).toBeUndefined();
  });
});