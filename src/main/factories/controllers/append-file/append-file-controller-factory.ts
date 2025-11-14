import { AppendFileControllerImpl } from "../../../../presentation/controllers/append-file/append-file-controller.js";
import { makeAppendFile } from "../../use-cases/append-file-factory.js";
import { makeAppendValidation } from "./append-file-validation-factory.js";

export const makeAppendFileController = () => {
  const useCase = makeAppendFile();
  const validator = makeAppendValidation();

  return new AppendFileControllerImpl(useCase, validator);
};