import { GetFileVersionControllerImpl } from "../../../../presentation/controllers/get-file-version/get-file-version-controller.js";
import { makeGetFileVersion } from "../../../factories/use-cases/get-file-version-factory.js";
import { makeGetFileVersionValidation } from "./get-file-version-validation-factory.js";

export const makeGetFileVersionController = () => {
  const useCase = makeGetFileVersion();
  const validator = makeGetFileVersionValidation();

  return new GetFileVersionControllerImpl(useCase, validator);
};