import * as crypto from "crypto";

import * as express from "express";

import { isLeft } from "fp-ts/lib/Either";
import { isNone } from "fp-ts/lib/Option";

import { TableClient } from "@azure/data-tables";
import { Context } from "@azure/functions";

import { ValidationTokenEntityAzureDataTables } from "@pagopa/io-functions-commons/dist/src/entities/validation_token";
import { ProfileModel } from "@pagopa/io-functions-commons/dist/src/models/profile";
import { ContextMiddleware } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/context_middleware";
import {
  withRequestMiddlewares,
  wrapRequestHandler
} from "@pagopa/io-functions-commons/dist/src/utils/request_middleware";
import {
  IProfileEmailReader,
  isEmailAlreadyTaken
} from "@pagopa/io-functions-commons/dist/src/utils/unique_email_enforcement";
import { readableReport } from "@pagopa/ts-commons/lib/reporters";
import {
  IResponseErrorInternal,
  IResponseErrorUnauthorized,
  IResponseSuccessJson,
  ResponseErrorInternal,
  ResponseErrorUnauthorized,
  ResponseSuccessJson
} from "@pagopa/ts-commons/lib/responses";
import {
  GetTokenInfoResponse,
  StatusEnum as GetTokenInfoStatusEnum
} from "../generated/definitions/external/GetTokenInfoResponse";
import {
  ValidationErrorsObject,
  ReasonEnum as ValidationErrorsReasonEnum,
  StatusEnum as ValidationErrorsStatusEnum
} from "../generated/definitions/external/ValidationErrorsObject";
import { retrieveTableEntity } from "../utils/azure_storage";
import {
  TokenQueryParam,
  TokenQueryParamMiddleware
} from "../utils/middleware";
import { ValidationErrors } from "../utils/validation_errors";

type IGetTokenInfoHandler = (
  context: Context,
  token: TokenQueryParam
) => Promise<
  | IResponseErrorInternal
  | IResponseErrorUnauthorized
  | IResponseSuccessJson<GetTokenInfoResponse | ValidationErrorsObject>
>;

const buildValidationErrorsObjects = (
  reason: ValidationErrorsReasonEnum
): IResponseSuccessJson<ValidationErrorsObject> =>
  ResponseSuccessJson({
    status: ValidationErrorsStatusEnum.FAILURE,
    reason
  });

export const GetTokenInfoHandler = (
  tableClient: TableClient,
  profileModel: ProfileModel,
  profileEmails: IProfileEmailReader
): IGetTokenInfoHandler => async (
  context,
  token
): Promise<
  | IResponseErrorInternal
  | IResponseErrorUnauthorized
  | IResponseSuccessJson<GetTokenInfoResponse | ValidationErrorsObject>
> => {
  const logPrefix = `ValidateProfileEmail|TOKEN=${token}`;

  // STEP 1: Find and verify validation token

  // A token is in the following format:
  // [tokenId ULID] + ":" + [validatorHash crypto.randomBytes(12)]
  // Split the token to get tokenId and validatorHash
  const [tokenId, validator] = token.split(":");
  const validatorHash = crypto
    .createHash("sha256")
    .update(validator)
    .digest("hex");

  // Retrieve the entity from the table storage
  const errorOrMaybeTableEntity = await retrieveTableEntity(
    tableClient,
    tokenId,
    validatorHash
  );

  if (isLeft(errorOrMaybeTableEntity)) {
    context.log.error(
      `${logPrefix}|Error searching validation token|ERROR=${errorOrMaybeTableEntity.left.message}`
    );
    return ResponseErrorInternal(ValidationErrors.GENERIC_ERROR);
  }

  const maybeTokenEntity = errorOrMaybeTableEntity.right;

  if (isNone(maybeTokenEntity)) {
    context.log.error(`${logPrefix}|Validation token not found`);
    return ResponseErrorUnauthorized(ValidationErrors.INVALID_TOKEN);
  }

  // Check if the entity is a ValidationTokenEntity
  const errorOrValidationTokenEntity = ValidationTokenEntityAzureDataTables.decode(
    maybeTokenEntity.value
  );

  if (isLeft(errorOrValidationTokenEntity)) {
    context.log.error(
      `${logPrefix}|Validation token can't be decoded|ERROR=${readableReport(
        errorOrValidationTokenEntity.left
      )}`
    );
    return ResponseErrorInternal(ValidationErrors.GENERIC_ERROR);
  }

  const validationTokenEntity = errorOrValidationTokenEntity.right;
  const {
    Email: email,
    InvalidAfter: invalidAfter,
    FiscalCode: fiscalCode
  } = validationTokenEntity;

  // Check if the token is expired
  if (Date.now() > invalidAfter.getTime()) {
    context.log.error(`${logPrefix}|Token expired|EXPIRED_AT=${invalidAfter}`);

    return buildValidationErrorsObjects(
      ValidationErrorsReasonEnum.TOKEN_EXPIRED
    );
  }

  // STEP 2: Find the profile
  const errorOrMaybeExistingProfile = await profileModel.findLastVersionByModelId(
    [fiscalCode]
  )();

  if (isLeft(errorOrMaybeExistingProfile)) {
    context.log.error(
      `${logPrefix}|Error searching the profile|ERROR=`,
      errorOrMaybeExistingProfile.left
    );
    return ResponseErrorInternal(ValidationErrors.GENERIC_ERROR);
  }

  const maybeExistingProfile = errorOrMaybeExistingProfile.right;
  if (isNone(maybeExistingProfile)) {
    context.log.error(`${logPrefix}|Profile not found`);
    return ResponseErrorInternal(ValidationErrors.GENERIC_ERROR);
  }

  const existingProfile = maybeExistingProfile.value;

  // Check if the email in the profile is the same of the one in the validation token
  if (existingProfile.email !== email) {
    context.log.error(`${logPrefix}|Email mismatch`);

    return buildValidationErrorsObjects(
      ValidationErrorsReasonEnum.TOKEN_EXPIRED
    );
  }

  // Check if the e-mail is already taken
  try {
    const isEmailTaken = await isEmailAlreadyTaken(email)({
      profileEmails
    });
    if (isEmailTaken) {
      return buildValidationErrorsObjects(
        ValidationErrorsReasonEnum.EMAIL_ALREADY_TAKEN
      );
    }
  } catch {
    context.log.error(`${logPrefix}| Check for e-mail uniqueness failed`);
    return ResponseErrorInternal(ValidationErrors.GENERIC_ERROR);
  }

  return ResponseSuccessJson({
    status: GetTokenInfoStatusEnum.SUCCESS,
    profile_email: email
  });
};

/**
 * Wraps a GetTokenInfo handler inside an Express request handler.
 */

export const GetTokenInfo = (
  tableClient: TableClient,
  profileModel: ProfileModel,
  profileEmails: IProfileEmailReader
): express.RequestHandler => {
  const handler = GetTokenInfoHandler(tableClient, profileModel, profileEmails);

  const middlewaresWrap = withRequestMiddlewares(
    ContextMiddleware(),
    TokenQueryParamMiddleware
  );
  return wrapRequestHandler(middlewaresWrap(handler));
};
