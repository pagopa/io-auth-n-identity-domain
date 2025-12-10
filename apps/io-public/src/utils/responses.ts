import {
  IResponseSuccessJson,
  ResponseSuccessJson
} from "@pagopa/ts-commons/lib/responses";
import {
  ValidationErrorsObject,
  ReasonEnum as ValidationErrorsReasonEnum,
  StatusEnum as ValidationErrorsStatusEnum
} from "../generated/definitions/external/ValidationErrorsObject";

export const buildValidationErrorsObjectsResponse = (
  reason: ValidationErrorsReasonEnum
): IResponseSuccessJson<ValidationErrorsObject> =>
  ResponseSuccessJson({
    status: ValidationErrorsStatusEnum.FAILURE,
    reason
  });
