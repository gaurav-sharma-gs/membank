import { beforeEach, describe, expect, test, vi } from "vitest";
import { FileRepository } from "../../../../src/data/protocols/file-repository.js";
import { ProjectRepository } from "../../../../src/data/protocols/project-repository.js";
import { GetFileVersion } from "../../../../src/data/usecases/get-file-version/get-file-version.js";
import { MockFileRepository, MockProjectRepository } from "../../mocks/index.js";

describe("RevertFileVersion UseCase", () => {
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
      versionId: "20231010T120000Z",
    };

    await sut.revertFileVersion(params);

    expect(projectExistsSpy).toHaveBeenCalledWith("test-project");
  });

  test("should return null when project does not exist", async () => {
    const params = {
      projectName: "nonexistent-project",
      fileName: "test-file.txt",
      versionId: "20231010T120000Z",
    };
    vi.spyOn(projectRepositoryStub, "projectExists").mockResolvedValueOnce(false);

    const result = await sut.revertFileVersion(params);

    expect(result).toBeNull();
  });

  test("should call FileRepository.revertFileVersion with correct params when project exists", async () => {
    const revertFileVersionSpy = vi.spyOn(fileRepositoryStub, "revertFileVersion");
    const params = {
      projectName: "test-project",
      fileName: "test-file.txt",
      versionId: "20231010T120000Z",
    };
    vi.spyOn(projectRepositoryStub, "projectExists").mockResolvedValueOnce(true);

    await sut.revertFileVersion(params);

    expect(revertFileVersionSpy).toHaveBeenCalledWith(
      "test-project",
      "test-file.txt",
      "20231010T120000Z"
    );
 });

  test("should return reverted file content when revert is successful", async () => {
    const params = {
      projectName: "test-project",
      fileName: "test-file.txt",
      versionId: "20231010T120000Z",
    };
    const expectedContent = "reverted content";
    vi.spyOn(projectRepositoryStub, "projectExists").mockResolvedValueOnce(true);
    vi.spyOn(fileRepositoryStub, "revertFileVersion").mockResolvedValueOnce(
      expectedContent
    );

    const result = await sut.revertFileVersion(params);

    expect(result).toBe(expectedContent);
  });

  test("should return null when revert fails", async () => {
    const params = {
      projectName: "test-project",
      fileName: "test-file.txt",
      versionId: "20231010T12000Z",
    };
    vi.spyOn(projectRepositoryStub, "projectExists").mockResolvedValueOnce(true);
    vi.spyOn(fileRepositoryStub, "revertFileVersion").mockResolvedValueOnce(null);

    const result = await sut.revertFileVersion(params);

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

    await expect(sut.revertFileVersion(params)).rejects.toThrow(error);
  });
});