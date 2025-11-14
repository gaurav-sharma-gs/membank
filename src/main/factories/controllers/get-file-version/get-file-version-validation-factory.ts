import { Validator } from "../../../../presentation/protocols/validator.js";
import {
  RequiredFieldValidator,
  ValidatorComposite,
} from "../../../../validators/index.js";
import { PathSecurityValidator } from "../../../../validators/path-security-validator.js";

const makeGetFileVersionValidations = (): Validator[] => {
  return [
    new RequiredFieldValidator("projectName"),
    new RequiredFieldValidator("fileName"),
    new RequiredFieldValidator("versionId"),
    new PathSecurityValidator("projectName"),
    new PathSecurityValidator("fileName"),
    new PathSecurityValidator("versionId"),
  ];
};

export const makeGetFileVersionValidation = (): Validator => {
  const validations = makeGetFileVersionValidations();
  return new ValidatorComposite(validations);
};