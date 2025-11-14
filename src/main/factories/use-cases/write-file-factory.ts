import { WriteFile } from "../../../data/usecases/write-file/write-file.js";
import { FsFileRepository } from "../../../infra/filesystem/index.js";
import { CachedFileRepository } from "../../../infra/filesystem/repositories/cached-file-repository.js";
import { FsProjectRepository } from "../../../infra/filesystem/repositories/fs-project-repository.js";
import { env } from "../../config/env.js";

export const makeWriteFile = () => {
  const projectRepository = new FsProjectRepository(env.rootPath);
  const fsFileRepository = new FsFileRepository(env.rootPath);
  const fileRepository = new CachedFileRepository(fsFileRepository);

  return new WriteFile(fileRepository, projectRepository);
};
