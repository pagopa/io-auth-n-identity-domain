import * as express from "express";

import { isLeft } from "fp-ts/lib/Either";
import { isNone } from "fp-ts/lib/Option";

import { TableClient } from "@azure/data-tables";
import { Context } from "@azure/functions";

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
  ReasonEnum as ValidationErrorsReasonEnum
} from "../generated/definitions/external/ValidationErrorsObject";
import { TokenHeaderParamMiddleware, TokenParam } from "../utils/middleware";
import { buildValidationErrorsObjectsResponse } from "../utils/responses";
import { retrieveValidationTokenEntity } from "../utils/validation-token";
import { ValidationErrors } from "../utils/validation_errors";

type IGetTokenInfoHandler = (
  context: Context,
  token: TokenParam
) => Promise<
  | IResponseErrorInternal
  | IResponseErrorUnauthorized
  | IResponseSuccessJson<GetTokenInfoResponse | ValidationErrorsObject>
>;

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
  const logPrefix = `GetTokenInfo|TOKEN=${token}`;

  // STEP 1: Find and verify validation token

  // 1.1 Retrieve the entity from the table storage
  const errorOrMaybeTableEntity = await retrieveValidationTokenEntity(
    tableClient,
    token
  )();

  if (isLeft(errorOrMaybeTableEntity)) {
    context.log.error(
      `${logPrefix}|Error searching validation token|ERROR=`,
      errorOrMaybeTableEntity.left
    );
    return ResponseErrorInternal(ValidationErrors.GENERIC_ERROR);
  }

  const maybeTokenEntity = errorOrMaybeTableEntity.right;

  if (isNone(maybeTokenEntity)) {
    context.log.error(`${logPrefix}|Validation token not found`);
    return ResponseErrorUnauthorized(ValidationErrors.INVALID_TOKEN);
  }

  const {
    Email: email,
    InvalidAfter: invalidAfter,
    FiscalCode: fiscalCode
  } = maybeTokenEntity.value;

  // 1.2 Check if the token is expired
  if (Date.now() > invalidAfter.getTime()) {
    context.log.error(`${logPrefix}|Token expired|EXPIRED_AT=${invalidAfter}`);

    return buildValidationErrorsObjectsResponse(
      ValidationErrorsReasonEnum.TOKEN_EXPIRED
    );
  }

  // STEP 2: Find the profile

  // 2.1 Search for the profile associated to the fiscal code in the token
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

  // 2.2 Check if the email in the profile is the same of the one in the validation token
  if (existingProfile.email !== email) {
    context.log.error(`${logPrefix}|Email mismatch`);

    return buildValidationErrorsObjectsResponse(
      ValidationErrorsReasonEnum.TOKEN_EXPIRED
    );
  }

  // 2.3 Check if the e-mail is already taken
  try {
    const isEmailTaken = await isEmailAlreadyTaken(email)({
      profileEmails
    });
    if (isEmailTaken) {
      return buildValidationErrorsObjectsResponse(
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
    TokenHeaderParamMiddleware
  );
  return wrapRequestHandler(middlewaresWrap(handler));
};
