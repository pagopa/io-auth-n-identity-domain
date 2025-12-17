import * as express from "express";

import * as E from "fp-ts/lib/Either";
import * as O from "fp-ts/lib/Option";
import * as RTE from "fp-ts/lib/ReaderTaskEither";
import * as TE from "fp-ts/lib/TaskEither";

import { TableClient } from "@azure/data-tables";
import { Context } from "@azure/functions";

import { ValidationTokenEntityAzureDataTables } from "@pagopa/io-functions-commons/dist/src/entities/validation_token";
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
import { EmailString, FiscalCode } from "@pagopa/ts-commons/lib/strings";
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

type HandlerDependencies = {
  tableClient: TableClient;
  profileModel: ProfileModel;
  profileEmails: IProfileEmailReader;
};

const updateProfile: (
  existingProfile: RetrievedProfile,
  context: Context,
  logPrefix: string
) => RTE.ReaderTaskEither<
  { profileModel: ProfileModel },
  IResponseErrorInternal,
  void
> = (existingProfile, context, logPrefix) => ({ profileModel }) =>
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

const resolveValidationToken: (
  token: TokenParam,
  context: Context,
  logPrefix: string
) => RTE.ReaderTaskEither<
  { tableClient: TableClient },
  | IResponseErrorInternal
  | IResponseErrorUnauthorized
  | IResponseSuccessJson<ValidationErrorsObject>,
  ValidationTokenEntityAzureDataTables
> = (token, context, logPrefix) => ({ tableClient }) =>
  pipe(
    retrieveValidationTokenEntity(tableClient, token),
    TE.mapLeft(error => {
      context.log.error(
        `${logPrefix}|Error searching validation token|ERROR=`,
        error
      );
      return ResponseErrorInternal(ValidationErrors.GENERIC_ERROR);
    }),
    TE.chainEitherKW(
      O.fold(
        () => {
          context.log.error(`${logPrefix}|Validation token not found`);
          return E.left(
            ResponseErrorUnauthorized(ValidationErrors.INVALID_TOKEN)
          );
        },
        tokenEntity => E.right(tokenEntity)
      )
    ),
    TE.chainW(
      TE.fromPredicate(
        ({ InvalidAfter }) => Date.now() <= InvalidAfter.getTime(),
        ({ InvalidAfter, Email }) => {
          context.log.error(
            `${logPrefix}|Token expired|EXPIRED_AT=${InvalidAfter}`
          );
          return buildValidationErrorsObjectsResponse(
            ValidationErrorsReasonEnum.TOKEN_EXPIRED,
            Email
          );
        }
      )
    )
  );

const retrieveProfile: (
  fiscalCode: FiscalCode,
  context: Context,
  logPrefix: string
) => RTE.ReaderTaskEither<
  { profileModel: ProfileModel },
  IResponseErrorInternal,
  RetrievedProfile
> = (fiscalCode, context, logPrefix) => ({ profileModel }) =>
  pipe(
    profileModel.findLastVersionByModelId([fiscalCode]),
    TE.mapLeft(error => {
      context.log.error(
        `${logPrefix}|Error searching the profile|ERROR=`,
        error
      );
      return ResponseErrorInternal(ValidationErrors.GENERIC_ERROR);
    }),
    TE.chainEitherKW(
      O.fold(
        () => {
          context.log.error(`${logPrefix}|Profile not found`);
          return E.left(ResponseErrorInternal(ValidationErrors.GENERIC_ERROR));
        },
        profile => E.right(profile)
      )
    )
  );

const validateProfile = (
  retrievedProfile: RetrievedProfile,
  tokenEntity: ValidationTokenEntityAzureDataTables,
  context: Context,
  logPrefix: string
): E.Either<IResponseErrorUnauthorized, void> =>
  pipe(
    retrievedProfile,
    E.fromPredicate(
      profile => profile.email === tokenEntity.Email,
      () => {
        context.log.error(`${logPrefix}|Email mismatch`);
        return ResponseErrorUnauthorized(ValidationErrors.INVALID_TOKEN);
      }
    ),
    E.map(() => void 0)
  );

const enforceEmailUniqueness: (
  email: EmailString,
  context: Context,
  logPrefix: string
) => RTE.ReaderTaskEither<
  { profileEmails: IProfileEmailReader },
  IResponseErrorInternal | IResponseSuccessJson<ValidationErrorsObject>,
  boolean
> = (email, context, logPrefix) => ({ profileEmails }) =>
  pipe(
    TE.tryCatch(
      () => isEmailAlreadyTaken(email)({ profileEmails }),
      err => {
        context.log.error(
          `${logPrefix}| Check for e-mail uniqueness failed`,
          err
        );
        return ResponseErrorInternal(ValidationErrors.GENERIC_ERROR);
      }
    ),
    TE.chainW(
      TE.fromPredicate(
        isTaken => !isTaken,
        () =>
          buildValidationErrorsObjectsResponse(
            ValidationErrorsReasonEnum.EMAIL_ALREADY_TAKEN,
            email
          )
      )
    )
  );

type ValidateRequestResult = {
  tokenEntity: ValidationTokenEntityAzureDataTables;
  existingProfile: RetrievedProfile;
};

// Base handler shared between GetTokenInfo and ValidateProfileEmail
const baseHandler: (
  token: TokenParam,
  context: Context,
  logPrefix: string
) => RTE.ReaderTaskEither<
  HandlerDependencies,
  | IResponseErrorInternal
  | IResponseErrorUnauthorized
  | IResponseSuccessJson<ValidationErrorsObject>,
  ValidateRequestResult
> = (token, context, logPrefix) =>
  pipe(
    resolveValidationToken(token, context, logPrefix),
    RTE.bindTo("tokenEntity"),
    RTE.bindW("existingProfile", ({ tokenEntity }) =>
      retrieveProfile(tokenEntity.FiscalCode, context, logPrefix)
    ),
    RTE.chainFirstW(({ existingProfile, tokenEntity }) =>
      RTE.fromEither(
        validateProfile(existingProfile, tokenEntity, context, logPrefix)
      )
    ),
    RTE.chainFirstW(({ tokenEntity }) =>
      enforceEmailUniqueness(tokenEntity.Email, context, logPrefix)
    )
  );

export const ValidateProfileEmailHandler = (
  deps: HandlerDependencies
): IGetTokenInfoHandler => async (
  context,
  token
): Promise<
  | IResponseErrorInternal
  | IResponseErrorUnauthorized
  | IResponseSuccessJson<ValidateProfileStatusReport | ValidationErrorsObject>
> => {
  const logPrefix = `ValidateProfileEmailHandler|TOKEN=${token}`;

  return pipe(
    baseHandler(token, context, logPrefix),
    RTE.chainW(({ existingProfile }) =>
      updateProfile(existingProfile, context, logPrefix)
    ),
    RTE.map(() =>
      ResponseSuccessJson({
        status: GetTokenInfoStatusEnum.SUCCESS
      })
    ),
    RTE.toUnion
  )(deps)();
};

export const GetTokenInfoHandler = (
  deps: HandlerDependencies
): IGetTokenInfoHandler => async (
  context,
  token
): Promise<
  | IResponseErrorInternal
  | IResponseErrorUnauthorized
  | IResponseSuccessJson<GetTokenInfoResponse | ValidationErrorsObject>
> => {
  const logPrefix = `GetTokenInfo|TOKEN=${token}`;

  return pipe(
    baseHandler(token, context, logPrefix),
    RTE.map(({ tokenEntity }) =>
      ResponseSuccessJson({
        status: GetTokenInfoStatusEnum.SUCCESS,
        profile_email: tokenEntity.Email
      })
    ),
    RTE.toUnion
  )(deps)();
};

/**
 * Wraps the handler inside an Express request handler (GetTokenInfo operation).
 */

export const GetTokenInfo = (
  tableClient: TableClient,
  profileModel: ProfileModel,
  profileEmails: IProfileEmailReader
): express.RequestHandler => {
  const handler = GetTokenInfoHandler({
    tableClient,
    profileModel,
    profileEmails
  });

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
  const handler = ValidateProfileEmailHandler({
    tableClient,
    profileModel,
    profileEmails
  });

  const middlewaresWrap = withRequestMiddlewares(
    ContextMiddleware(),
    ValidateProfileEmailBodyMiddleware
  );
  return wrapRequestHandler(
    middlewaresWrap((context, body) => handler(context, body.token))
  );
};
