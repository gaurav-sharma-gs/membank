import { AppendFile } from "../../../data/usecases/append-file/append-file.js";
import { FsFileRepository } from "../../../infra/filesystem/index.js";
import { FsProjectRepository } from "../../../infra/filesystem/repositories/fs-project-repository.js";
import { env } from "../../config/env.js";

export const makeAppendFile = () => {
  const projectRepository = new FsProjectRepository(env.rootPath);
  const fileRepository = new FsFileRepository(env.rootPath);

  return new AppendFile(fileRepository, projectRepository);
};