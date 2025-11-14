import { GetFileVersion } from "../../../data/usecases/get-file-version/get-file-version.js";
import { FsFileRepository } from "../../../infra/filesystem/index.js";
import { FsProjectRepository } from "../../../infra/filesystem/repositories/fs-project-repository.js";
import { env } from "../../config/env.js";

export const makeGetFileVersion = () => {
  const projectRepository = new FsProjectRepository(env.rootPath);
  const fileRepository = new FsFileRepository(env.rootPath);

  return new GetFileVersion(fileRepository, projectRepository);
};