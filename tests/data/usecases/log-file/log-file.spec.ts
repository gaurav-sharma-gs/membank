import { describe, it, expect, vi, beforeEach } from "vitest";
import { LogFile } from "../../../../src/data/usecases/log-file/log-file.js";
import { FileRepository } from "../../../../src/data/protocols/file-repository.js";
import { ProjectRepository } from "../../../../src/data/protocols/project-repository.js";

describe("LogFile Use Case", () => {
  let fileRepository: FileRepository;
  let projectRepository: ProjectRepository;
  let logFileUseCase: LogFile;

  beforeEach(() => {
    fileRepository = {
      listFiles: vi.fn(),
      loadFile: vi.fn(),
      writeFile: vi.fn(),
      updateFile: vi.fn(),
      appendFile: vi.fn(),
      logFile: vi.fn(),
      listFileVersions: vi.fn(),
      getFileVersion: vi.fn(),
      revertFileVersion: vi.fn(),
      cleanupOldVersions: vi.fn(),
    };

    projectRepository = {
      listProjects: vi.fn(),
      projectExists: vi.fn(),
      ensureProject: vi.fn(),
    };

    logFileUseCase = new LogFile(fileRepository, projectRepository);
  });

  it("should call projectRepository.ensureProject with projectName", async () => {
    const params = {
      projectName: "test-project",
      fileName: "test-file.txt",
      content: "Test content",
    };

    await logFileUseCase.logFile(params);

    expect(projectRepository.ensureProject).toHaveBeenCalledWith("test-project");
  });

  it("should call fileRepository.logFile with correct parameters", async () => {
    const params = {
      projectName: "test-project",
      fileName: "test-file.txt",
      content: "Test content",
    };

    await logFileUseCase.logFile(params);

    expect(fileRepository.logFile).toHaveBeenCalledWith(
      "test-project",
      "test-file.txt",
      "Test content"
    );
  });

  it("should handle successful logging", async () => {
    const params = {
      projectName: "test-project",
      fileName: "test-file.txt",
      content: "Test content",
    };

    vi.mocked(projectRepository.ensureProject).mockResolvedValue();
    vi.mocked(fileRepository.logFile).mockResolvedValue();

    await expect(logFileUseCase.logFile(params)).resolves.not.toThrow();
  });

  it("should throw error when fileRepository.logFile fails", async () => {
    const params = {
      projectName: "test-project",
      fileName: "test-file.txt",
      content: "Test content",
    };

    const error = new Error("Failed to log file");
    vi.mocked(fileRepository.logFile).mockRejectedValue(error);

    await expect(logFileUseCase.logFile(params)).rejects.toThrow("Failed to log file");
  });
});