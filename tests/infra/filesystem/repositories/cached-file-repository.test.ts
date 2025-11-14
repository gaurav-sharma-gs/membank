import { beforeEach, describe, expect, test, vi } from "vitest";
import { CachedFileRepository } from "../../../../src/infra/filesystem/repositories/cached-file-repository.js";
import { FsFileRepository } from "../../../../src/infra/filesystem/repositories/fs-file-repository.js";

describe("CachedFileRepository", () => {
  let fsFileRepository: FsFileRepository;
  let sut: CachedFileRepository;

  beforeEach(() => {
    fsFileRepository = new FsFileRepository("/tmp/test"); // Use temp path for testing
    sut = new CachedFileRepository(fsFileRepository);
  });

  describe("loadFile", () => {
    test("should call underlying repository to load file when not cached", async () => {
      const expectedContent = "file content";
      const loadFileSpy = vi.spyOn(fsFileRepository, "loadFile").mockResolvedValueOnce(expectedContent);
      
      const result = await sut.loadFile("test-project", "test-file.txt");

      expect(loadFileSpy).toHaveBeenCalledWith("test-project", "test-file.txt");
      expect(result).toBe(expectedContent);
    });

    test("should return cached content on second call for same file", async () => {
      const expectedContent = "file content";
      const loadFileSpy = vi.spyOn(fsFileRepository, "loadFile").mockResolvedValueOnce(expectedContent);
      
      // First call - should hit repository
      await sut.loadFile("test-project", "test-file.txt");
      // Second call - should use cache
      await sut.loadFile("test-project", "test-file.txt");

      expect(loadFileSpy).toHaveBeenCalledTimes(1);
    });

    test("should return null when file does not exist", async () => {
      const loadFileSpy = vi.spyOn(fsFileRepository, "loadFile").mockResolvedValueOnce(null);
      
      const result = await sut.loadFile("test-project", "nonexistent-file.txt");

      expect(result).toBeNull();
      expect(loadFileSpy).toHaveBeenCalledWith("test-project", "nonexistent-file.txt");
    });
  });

  describe("writeFile", () => {
    test("should call underlying repository and invalidate cache", async () => {
      const expectedContent = "new content";
      const writeFileSpy = vi.spyOn(fsFileRepository, "writeFile").mockResolvedValueOnce(expectedContent);
      const loadFileSpy = vi.spyOn(fsFileRepository, "loadFile").mockResolvedValueOnce(expectedContent);
      
      // Load file to cache it
      await sut.loadFile("test-project", "test-file.txt");
      expect(loadFileSpy).toHaveBeenCalledTimes(1);
      
      // Write file - should invalidate cache
      await sut.writeFile("test-project", "test-file.txt", "new content");
      
      // Load again - should hit repository again due to cache invalidation
      await sut.loadFile("test-project", "test-file.txt");
      
      expect(loadFileSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe("updateFile", () => {
    test("should call underlying repository and invalidate cache", async () => {
      const expectedContent = "updated content";
      const updateFileSpy = vi.spyOn(fsFileRepository, "updateFile").mockResolvedValueOnce(expectedContent);
      const loadFileSpy = vi.spyOn(fsFileRepository, "loadFile").mockResolvedValueOnce(expectedContent);
      
      // Load file to cache it
      await sut.loadFile("test-project", "test-file.txt");
      expect(loadFileSpy).toHaveBeenCalledTimes(1);
      
      // Update file - should invalidate cache
      await sut.updateFile("test-project", "test-file.txt", "updated content");
      
      // Load again - should hit repository again due to cache invalidation
      await sut.loadFile("test-project", "test-file.txt");
      
      expect(loadFileSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe("appendFile", () => {
    test("should call underlying repository and invalidate cache", async () => {
      const appendFileSpy = vi.spyOn(fsFileRepository, "appendFile").mockResolvedValueOnce(undefined);
      const loadFileSpy = vi.spyOn(fsFileRepository, "loadFile").mockResolvedValueOnce("updated content");
      
      // Load file to cache it
      await sut.loadFile("test-project", "test-file.txt");
      expect(loadFileSpy).toHaveBeenCalledTimes(1);
      
      // Append file - should invalidate cache
      await sut.appendFile("test-project", "test-file.txt", "new content");
      
      // Load again - should hit repository again due to cache invalidation
      await sut.loadFile("test-project", "test-file.txt");
      
      expect(loadFileSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe("listFiles", () => {
    test("should call underlying repository for listFiles", async () => {
      const expectedFiles = ["file1.txt", "file2.txt"];
      const listFilesSpy = vi.spyOn(fsFileRepository, "listFiles").mockResolvedValueOnce(expectedFiles);
      
      const result = await sut.listFiles("test-project");

      expect(listFilesSpy).toHaveBeenCalledWith("test-project");
      expect(result).toEqual(expectedFiles);
    });
  });

  describe("logFile", () => {
    test("should call underlying repository and invalidate cache", async () => {
      const logFileSpy = vi.spyOn(fsFileRepository, "logFile").mockResolvedValueOnce(undefined);
      const loadFileSpy = vi.spyOn(fsFileRepository, "loadFile").mockResolvedValueOnce("updated content");
      
      // Load file to cache it
      await sut.loadFile("test-project", "test-file.txt");
      expect(loadFileSpy).toHaveBeenCalledTimes(1);
      
      // Log file - should invalidate cache
      await sut.logFile("test-project", "test-file.txt", "log content");
      
      // Load again - should hit repository again due to cache invalidation
      await sut.loadFile("test-project", "test-file.txt");
      
      expect(loadFileSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe("listFileVersions", () => {
    test("should call underlying repository for listFileVersions", async () => {
      const expectedVersions = [
        { versionId: "20231010T120000Z", timestamp: new Date(), size: 10 }
      ];
      const listFileVersionsSpy = vi.spyOn(fsFileRepository, "listFileVersions").mockResolvedValueOnce(expectedVersions);
      
      const result = await sut.listFileVersions("test-project", "test-file.txt");

      expect(listFileVersionsSpy).toHaveBeenCalledWith("test-project", "test-file.txt");
      expect(result).toEqual(expectedVersions);
    });
  });

  describe("getFileVersion", () => {
    test("should call underlying repository to get version when not cached", async () => {
      const expectedContent = "version content";
      const getFileVersionSpy = vi.spyOn(fsFileRepository, "getFileVersion").mockResolvedValueOnce(expectedContent);
      
      const result = await sut.getFileVersion("test-project", "test-file.txt", "20231010T120000Z");

      expect(getFileVersionSpy).toHaveBeenCalledWith("test-project", "test-file.txt", "20231010T120000Z");
      expect(result).toBe(expectedContent);
    });

    test("should return cached version content on second call for same version", async () => {
      const expectedContent = "version content";
      const getFileVersionSpy = vi.spyOn(fsFileRepository, "getFileVersion").mockResolvedValueOnce(expectedContent);
      
      // First call - should hit repository
      await sut.getFileVersion("test-project", "test-file.txt", "20231010T120000Z");
      // Second call - should use cache
      await sut.getFileVersion("test-project", "test-file.txt", "20231010T120000Z");

      expect(getFileVersionSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("revertFileVersion", () => {
    test("should call underlying repository and invalidate cache", async () => {
      const expectedContent = "reverted content";
      const revertFileVersionSpy = vi.spyOn(fsFileRepository, "revertFileVersion").mockResolvedValueOnce(expectedContent);
      const loadFileSpy = vi.spyOn(fsFileRepository, "loadFile").mockResolvedValueOnce(expectedContent);
      
      // Load file to cache it
      await sut.loadFile("test-project", "test-file.txt");
      expect(loadFileSpy).toHaveBeenCalledTimes(1);
      
      // Revert file - should invalidate cache
      await sut.revertFileVersion("test-project", "test-file.txt", "20231010T120000Z");
      
      // Load again - should hit repository again due to cache invalidation
      await sut.loadFile("test-project", "test-file.txt");
      
      expect(loadFileSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe("cleanupOldVersions", () => {
    test("should call underlying repository for cleanupOldVersions", async () => {
      const cleanupOldVersionsSpy = vi.spyOn(fsFileRepository, "cleanupOldVersions").mockResolvedValueOnce(undefined);
      
      await sut.cleanupOldVersions("test-project", "test-file.txt", 5);

      expect(cleanupOldVersionsSpy).toHaveBeenCalledWith("test-project", "test-file.txt", 5);
    });
  });
});