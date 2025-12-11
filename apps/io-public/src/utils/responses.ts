import {
  IResponseSuccessJson,
  ResponseSuccessJson
} from "@pagopa/ts-commons/lib/responses";
import {
  ValidationErrorsObject,
  ReasonEnum as ValidationErrorsReasonEnum,
  StatusEnum as ValidationErrorsStatusEnum
} from "../generated/definitions/external/ValidationErrorsObject";
import { ProfileEmail } from "../generated/definitions/external/ProfileEmail";

export const buildValidationErrorsObjectsResponse = (
  reason: ValidationErrorsReasonEnum,
  profile_email: ProfileEmail
): IResponseSuccessJson<ValidationErrorsObject> =>
  ResponseSuccessJson({
    status: ValidationErrorsStatusEnum.FAILURE,
    reason,
    profile_email
  });
