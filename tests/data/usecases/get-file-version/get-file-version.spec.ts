import { beforeEach, describe, expect, test, vi } from "vitest";
import { FileRepository } from "../../../../src/data/protocols/file-repository.js";
import { ProjectRepository } from "../../../../src/data/protocols/project-repository.js";
import { GetFileVersion } from "../../../../src/data/usecases/get-file-version/get-file-version.js";
import { MockFileRepository, MockProjectRepository } from "../../mocks/index.js";

describe("GetFileVersion UseCase", () => {
  let sut: GetFileVersion;
  let fileRepositoryStub: FileRepository;
  let projectRepositoryStub: ProjectRepository;

  beforeEach(() => {
    fileRepositoryStub = new MockFileRepository();
    projectRepositoryStub = new MockProjectRepository();
    sut = new GetFileVersion(fileRepositoryStub, projectRepositoryStub);
  });

  test("should call ProjectRepository.projectExists with projectName", async () => {
    const projectExistsSpy = vi.spyOn(projectRepositoryStub, "projectExists").mockResolvedValueOnce(true);
    const params = {
      projectName: "test-project",
      fileName: "test-file.txt",
      versionId: "20231010T12000Z",
    };

    await sut.getFileVersion(params);

    expect(projectExistsSpy).toHaveBeenCalledWith("test-project");
  });

 test("should return null when project does not exist", async () => {
    const params = {
      projectName: "nonexistent-project",
      fileName: "test-file.txt",
      versionId: "20231010T12000Z",
    };
    vi.spyOn(projectRepositoryStub, "projectExists").mockResolvedValueOnce(false);

    const result = await sut.getFileVersion(params);

    expect(result).toBeNull();
  });

  test("should call FileRepository.getFileVersion with correct params when project exists", async () => {
    const getFileVersionSpy = vi.spyOn(fileRepositoryStub, "getFileVersion");
    const params = {
      projectName: "test-project",
      fileName: "test-file.txt",
      versionId: "20231010T12000Z",
    };
    vi.spyOn(projectRepositoryStub, "projectExists").mockResolvedValueOnce(true);

    await sut.getFileVersion(params);

    expect(getFileVersionSpy).toHaveBeenCalledWith(
      "test-project",
      "test-file.txt",
      "20231010T12000Z"
    );
  });

  test("should return file content when version exists", async () => {
    const params = {
      projectName: "test-project",
      fileName: "test-file.txt",
      versionId: "20231010T12000Z",
    };
    const expectedContent = "versioned content";
    vi.spyOn(projectRepositoryStub, "projectExists").mockResolvedValueOnce(true);
    vi.spyOn(fileRepositoryStub, "getFileVersion").mockResolvedValueOnce(
      expectedContent
    );

    const result = await sut.getFileVersion(params);

    expect(result).toBe(expectedContent);
  });

  test("should return null when version does not exist", async () => {
    const params = {
      projectName: "test-project",
      fileName: "test-file.txt",
      versionId: "20231010T12000Z",
    };
    vi.spyOn(projectRepositoryStub, "projectExists").mockResolvedValueOnce(true);
    vi.spyOn(fileRepositoryStub, "getFileVersion").mockResolvedValueOnce(null);

    const result = await sut.getFileVersion(params);

    expect(result).toBeNull();
  });

 test("should throw if repository throws", async () => {
    const error = new Error("Repository error");
    vi.spyOn(projectRepositoryStub, "projectExists").mockRejectedValueOnce(
      error
    );
    const params = {
      projectName: "test-project",
      fileName: "test-file.txt",
      versionId: "20231010T120000Z",
    };

    await expect(sut.getFileVersion(params)).rejects.toThrow(error);
  });
});