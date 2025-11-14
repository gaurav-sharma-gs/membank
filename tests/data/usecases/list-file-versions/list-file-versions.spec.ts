import { beforeEach, describe, expect, test, vi } from "vitest";
import { FileRepository } from "../../../../src/data/protocols/file-repository.js";
import { ProjectRepository } from "../../../../src/data/protocols/project-repository.js";
import { GetFileVersion } from "../../../../src/data/usecases/get-file-version/get-file-version.js";
import { MockFileRepository, MockProjectRepository } from "../../mocks/index.js";

describe("ListFileVersions UseCase", () => {
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
    };

    await sut.listFileVersions(params);

    expect(projectExistsSpy).toHaveBeenCalledWith("test-project");
  });

  test("should return empty array when project does not exist", async () => {
    const params = {
      projectName: "nonexistent-project",
      fileName: "test-file.txt",
    };
    vi.spyOn(projectRepositoryStub, "projectExists").mockResolvedValueOnce(false);

    const result = await sut.listFileVersions(params);

    expect(result).toEqual([]);
  });

  test("should call FileRepository.listFileVersions with correct params when project exists", async () => {
    const listFileVersionsSpy = vi.spyOn(fileRepositoryStub, "listFileVersions");
    const params = {
      projectName: "test-project",
      fileName: "test-file.txt",
    };
    vi.spyOn(projectRepositoryStub, "projectExists").mockResolvedValueOnce(true);

    await sut.listFileVersions(params);

    expect(listFileVersionsSpy).toHaveBeenCalledWith(
      "test-project",
      "test-file.txt"
    );
 });

  test("should return version info array when versions exist", async () => {
    const params = {
      projectName: "test-project",
      fileName: "test-file.txt",
    };
    const expectedVersions = [
      {
        versionId: "20231010T120000Z",
        timestamp: new Date(),
        size: 100,
      },
    ];
    vi.spyOn(projectRepositoryStub, "projectExists").mockResolvedValueOnce(true);
    vi.spyOn(fileRepositoryStub, "listFileVersions").mockResolvedValueOnce(
      expectedVersions
    );

    const result = await sut.listFileVersions(params);

    expect(result).toEqual(expectedVersions);
  });

  test("should return empty array when no versions exist", async () => {
    const params = {
      projectName: "test-project",
      fileName: "test-file.txt",
    };
    vi.spyOn(projectRepositoryStub, "projectExists").mockResolvedValueOnce(true);
    vi.spyOn(fileRepositoryStub, "listFileVersions").mockResolvedValueOnce([]);

    const result = await sut.listFileVersions(params);

    expect(result).toEqual([]);
  });

  test("should throw if repository throws", async () => {
    const error = new Error("Repository error");
    vi.spyOn(projectRepositoryStub, "projectExists").mockRejectedValueOnce(
      error
    );
    const params = {
      projectName: "test-project",
      fileName: "test-file.txt",
    };

    await expect(sut.listFileVersions(params)).rejects.toThrow(error);
  });
});