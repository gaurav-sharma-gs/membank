import { LogFileControllerImpl } from "../../../../presentation/controllers/log-file/log-file-controller.js";
import { makeLogFile } from "../../use-cases/log-file-factory.js";
import { makeLogValidation } from "./log-file-validation-factory.js";

export const makeLogFileController = () => {
  const useCase = makeLogFile();
  const validator = makeLogValidation();

  return new LogFileControllerImpl(useCase, validator);
};