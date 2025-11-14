import { UpdateFile } from "../../../data/usecases/update-file/update-file.js";
import { FsFileRepository } from "../../../infra/filesystem/index.js";
import { CachedFileRepository } from "../../../infra/filesystem/repositories/cached-file-repository.js";
import { FsProjectRepository } from "../../../infra/filesystem/repositories/fs-project-repository.js";
import { env } from "../../config/env.js";

export const makeUpdateFile = () => {
  const projectRepository = new FsProjectRepository(env.rootPath);
  const fsFileRepository = new FsFileRepository(env.rootPath);
  const fileRepository = new CachedFileRepository(fsFileRepository);

  return new UpdateFile(fileRepository, projectRepository);
};
