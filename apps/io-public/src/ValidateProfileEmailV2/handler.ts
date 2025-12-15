import * as express from "express";

import * as E from "fp-ts/lib/Either";
import * as O from "fp-ts/lib/Option";
import * as TE from "fp-ts/lib/TaskEither";

import { TableClient } from "@azure/data-tables";
import { Context } from "@azure/functions";

import {
  ProfileModel,
  RetrievedProfile
} from "@pagopa/io-functions-commons/dist/src/models/profile";
import { ContextMiddleware } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/context_middleware";
import {
  withRequestMiddlewares,
  wrapRequestHandler
} from "@pagopa/io-functions-commons/dist/src/utils/request_middleware";
import {
  IProfileEmailReader,
  isEmailAlreadyTaken
} from "@pagopa/io-functions-commons/dist/src/utils/unique_email_enforcement";
import { hashFiscalCode } from "@pagopa/ts-commons/lib/hash";
import {
  IResponseErrorInternal,
  IResponseErrorUnauthorized,
  IResponseSuccessJson,
  ResponseErrorInternal,
  ResponseErrorUnauthorized,
  ResponseSuccessJson
} from "@pagopa/ts-commons/lib/responses";
import { pipe } from "fp-ts/lib/function";
import {
  GetTokenInfoResponse,
  StatusEnum as GetTokenInfoStatusEnum
} from "../generated/definitions/external/GetTokenInfoResponse";
import { ValidateProfileStatusReport } from "../generated/definitions/external/ValidateProfileStatusReport";
import {
  ValidationErrorsObject,
  ReasonEnum as ValidationErrorsReasonEnum
} from "../generated/definitions/external/ValidationErrorsObject";
import { trackEvent } from "../utils/appinsights";
import {
  FlowType,
  FlowTypeEnum,
  TokenHeaderParamMiddleware,
  TokenParam,
  ValidateProfileEmailBodyMiddleware
} from "../utils/middleware";
import { buildValidationErrorsObjectsResponse } from "../utils/responses";
import { retrieveValidationTokenEntity } from "../utils/validation-token";
import { ValidationErrors } from "../utils/validation_errors";

type IGetTokenInfoHandler = (
  context: Context,
  token: TokenParam
) => Promise<
  | IResponseErrorInternal
  | IResponseErrorUnauthorized
  | IResponseSuccessJson<
      | GetTokenInfoResponse
      | ValidateProfileStatusReport
      | ValidationErrorsObject
    >
>;

const updateProfile = (
  profileModel: ProfileModel,
  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  existingProfile: RetrievedProfile,
  context: Context,
  logPrefix: string
): TE.TaskEither<IResponseErrorInternal, void> =>
  pipe(
    profileModel.update({
      ...existingProfile,
      isEmailValidated: true
    }),
    TE.mapLeft(error => {
      context.log.error(`${logPrefix}|Error updating profile|ERROR=`, error);
      return ResponseErrorInternal(ValidationErrors.GENERIC_ERROR);
    }),
    TE.map(() => {
      trackEvent({
        name: "io.citizen-auth.validate_email",
        tagOverrides: {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          "ai.user.id": hashFiscalCode(existingProfile.fiscalCode),
          samplingEnabled: "false"
        }
      });

      context.log.verbose(`${logPrefix}|The profile has been updated`);
      return void 0;
    })
  );

export const ValidateProfileEmailHandler = (
  tableClient: TableClient,
  profileModel: ProfileModel,
  profileEmails: IProfileEmailReader,
  flow: FlowType
): IGetTokenInfoHandler => async (
  context,
  token
): Promise<
  | IResponseErrorInternal
  | IResponseErrorUnauthorized
  | IResponseSuccessJson<
      | GetTokenInfoResponse
      | ValidateProfileStatusReport
      | ValidationErrorsObject
    >
> => {
  const logPrefix = `GetTokenInfo|TOKEN=${token}`;

  // STEP 1: Find and verify validation token

  // 1.1 Retrieve the entity from the table storage
  // TODO: move to a dedicated function
  const errorOrMaybeTableEntity = await retrieveValidationTokenEntity(
    tableClient,
    token
  )();

  if (E.isLeft(errorOrMaybeTableEntity)) {
    context.log.error(
      `${logPrefix}|Error searching validation token|ERROR=`,
      errorOrMaybeTableEntity.left
    );
    return ResponseErrorInternal(ValidationErrors.GENERIC_ERROR);
  }

  const maybeTokenEntity = errorOrMaybeTableEntity.right;

  if (O.isNone(maybeTokenEntity)) {
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
      ValidationErrorsReasonEnum.TOKEN_EXPIRED,
      email
    );
  }

  // STEP 2: Find the profile

  // 2.1 Search for the profile associated to the fiscal code in the token
  // TODO: move to a dedicated function
  const errorOrMaybeExistingProfile = await profileModel.findLastVersionByModelId(
    [fiscalCode]
  )();

  if (E.isLeft(errorOrMaybeExistingProfile)) {
    context.log.error(
      `${logPrefix}|Error searching the profile|ERROR=`,
      errorOrMaybeExistingProfile.left
    );
    return ResponseErrorInternal(ValidationErrors.GENERIC_ERROR);
  }

  const maybeExistingProfile = errorOrMaybeExistingProfile.right;
  if (O.isNone(maybeExistingProfile)) {
    context.log.error(`${logPrefix}|Profile not found`);
    return ResponseErrorInternal(ValidationErrors.GENERIC_ERROR);
  }

  const existingProfile = maybeExistingProfile.value;

  // 2.2 Check if the email in the profile is the same of the one in the validation token
  if (existingProfile.email !== email) {
    context.log.error(`${logPrefix}|Email mismatch`);

    return buildValidationErrorsObjectsResponse(
      ValidationErrorsReasonEnum.TOKEN_EXPIRED,
      email
    );
  }

  // 2.3 Check if the e-mail is already taken
  // TODO: move in a separate function
  try {
    const isEmailTaken = await isEmailAlreadyTaken(email)({
      profileEmails
    });
    if (isEmailTaken) {
      return buildValidationErrorsObjectsResponse(
        ValidationErrorsReasonEnum.EMAIL_ALREADY_TAKEN,
        email
      );
    }
  } catch {
    context.log.error(`${logPrefix}| Check for e-mail uniqueness failed`);
    return ResponseErrorInternal(ValidationErrors.GENERIC_ERROR);
  }

  if (flow === FlowTypeEnum.VALIDATE) {
    // On Validate Flow(GetTokenInfo) we just return the success response according to the spec
    return ResponseSuccessJson({
      status: GetTokenInfoStatusEnum.SUCCESS,
      profile_email: email
    });
  } else {
    // On Confirm Flow we will update the profile
    return pipe(
      updateProfile(profileModel, existingProfile, context, logPrefix),
      TE.map(() =>
        ResponseSuccessJson({
          status: GetTokenInfoStatusEnum.SUCCESS
        })
      ),
      TE.toUnion
    )();
  }
};

/**
 * Wraps the handler inside an Express request handler (GetTokenInfo operation).
 */

export const GetTokenInfo = (
  tableClient: TableClient,
  profileModel: ProfileModel,
  profileEmails: IProfileEmailReader
): express.RequestHandler => {
  const handler = ValidateProfileEmailHandler(
    tableClient,
    profileModel,
    profileEmails,
    FlowTypeEnum.VALIDATE
  );

  const middlewaresWrap = withRequestMiddlewares(
    ContextMiddleware(),
    TokenHeaderParamMiddleware
  );
  return wrapRequestHandler(middlewaresWrap(handler));
};

/**
 * Wraps the handler inside an Express request handler (ValidateProfileEmail operation).
 */

export const ValidateProfileEmail = (
  tableClient: TableClient,
  profileModel: ProfileModel,
  profileEmails: IProfileEmailReader
): express.RequestHandler => {
  const handler = ValidateProfileEmailHandler(
    tableClient,
    profileModel,
    profileEmails,
    FlowTypeEnum.CONFIRM
  );

  const middlewaresWrap = withRequestMiddlewares(
    ContextMiddleware(),
    ValidateProfileEmailBodyMiddleware
  );
  return wrapRequestHandler(
    middlewaresWrap((context, body) => handler(context, body.token))
  );
};
