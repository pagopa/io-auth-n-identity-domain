import * as crypto from "crypto";

import * as express from "express";

import { isLeft } from "fp-ts/lib/Either";
import { isNone } from "fp-ts/lib/Option";

import * as TE from "fp-ts/lib/TaskEither";
import { pipe } from "fp-ts/function";

import { Context } from "@azure/functions";
import { TableClient } from "@azure/data-tables";

import { readableReport } from "@pagopa/ts-commons/lib/reporters";
import {
  IResponseErrorValidation,
  IResponseSeeOtherRedirect,
  ResponseSeeOtherRedirect
} from "@pagopa/ts-commons/lib/responses";
import { hashFiscalCode } from "@pagopa/ts-commons/lib/hash";
import { ValidationTokenEntityAzureDataTables } from "@pagopa/io-functions-commons/dist/src/entities/validation_token";
import { ProfileModel } from "@pagopa/io-functions-commons/dist/src/models/profile";
import { ContextMiddleware } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/context_middleware";
import {
  withRequestMiddlewares,
  wrapRequestHandler
} from "@pagopa/io-functions-commons/dist/src/utils/request_middleware";
import { ValidUrl } from "@pagopa/ts-commons/lib/url";
import {
  IProfileEmailReader,
  isEmailAlreadyTaken
} from "@pagopa/io-functions-commons/dist/src/utils/unique_email_enforcement";
import { trackEvent } from "../utils/appinsights";
import { retrieveTableEntity } from "../utils/azure_storage";
import {
  ConfirmEmailFlowQueryParamMiddleware,
  FlowType,
  FlowTypeEnum,
  TokenQueryParam,
  TokenQueryParamMiddleware
} from "../utils/middleware";
import {
  confirmChoicePageUrl,
  validationFailureUrl,
  validationSuccessUrl
} from "../utils/redirect_url";
import { ValidationErrors } from "../utils/validation_errors";

type IValidateProfileEmailHandler = (
  context: Context,
  token: TokenQueryParam,
  flowChoice: FlowType
) => Promise<IResponseSeeOtherRedirect | IResponseErrorValidation>;

export const ValidateProfileEmailHandler = (
  tableClient: TableClient,
  profileModel: ProfileModel,
  emailValidationUrls: {
    readonly confirmValidationUrl: ValidUrl;
    readonly validationCallbackUrl: ValidUrl;
  },
  profileEmails: IProfileEmailReader
): IValidateProfileEmailHandler => async (
  context,
  token,
  flowChoice
): Promise<IResponseSeeOtherRedirect | IResponseErrorValidation> => {
  const logPrefix = `ValidateProfileEmail|TOKEN=${token}`;
  const { validationCallbackUrl, confirmValidationUrl } = emailValidationUrls;
  const vFailureUrl = (error: keyof typeof ValidationErrors): ValidUrl =>
    validationFailureUrl(validationCallbackUrl, error);

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
    return ResponseSeeOtherRedirect(
      vFailureUrl(ValidationErrors.GENERIC_ERROR)
    );
  }

  const maybeTokenEntity = errorOrMaybeTableEntity.right;

  if (isNone(maybeTokenEntity)) {
    context.log.error(`${logPrefix}|Validation token not found`);
    return ResponseSeeOtherRedirect(
      vFailureUrl(ValidationErrors.INVALID_TOKEN)
    );
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
    return ResponseSeeOtherRedirect(
      vFailureUrl(ValidationErrors.INVALID_TOKEN)
    );
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
    return ResponseSeeOtherRedirect(
      vFailureUrl(ValidationErrors.TOKEN_EXPIRED)
    );
  }

  // STEP 2: Find the profile
  const errorOrMaybeExistingProfile = await profileModel.findLastVersionByModelId(
    [fiscalCode]
  )();

  if (isLeft(errorOrMaybeExistingProfile)) {
    context.log.error(
      `${logPrefix}|Error searching the profile|ERROR=${errorOrMaybeExistingProfile.left}`
    );
    return ResponseSeeOtherRedirect(
      vFailureUrl(ValidationErrors.GENERIC_ERROR)
    );
  }

  const maybeExistingProfile = errorOrMaybeExistingProfile.right;
  if (isNone(maybeExistingProfile)) {
    context.log.error(`${logPrefix}|Profile not found`);
    return ResponseSeeOtherRedirect(
      vFailureUrl(ValidationErrors.GENERIC_ERROR)
    );
  }

  const existingProfile = maybeExistingProfile.value;

  // Check if the email in the profile is the same of the one in the validation token
  if (existingProfile.email !== email) {
    context.log.error(`${logPrefix}|Email mismatch`);
    return ResponseSeeOtherRedirect(
      vFailureUrl(ValidationErrors.INVALID_TOKEN)
    );
  }

  // Check if the e-mail is already taken
  try {
    const isEmailTaken = await isEmailAlreadyTaken(email)({
      profileEmails
    });
    if (isEmailTaken) {
      return ResponseSeeOtherRedirect(
        vFailureUrl(ValidationErrors.EMAIL_ALREADY_TAKEN)
      );
    }
  } catch {
    context.log.error(`${logPrefix}| Check for e-mail uniqueness failed`);
    return ResponseSeeOtherRedirect(
      vFailureUrl(ValidationErrors.GENERIC_ERROR)
    );
  }

  // Update the profile and set isEmailValidated to `true` ONLY if the flowChoice equals to VALIDATE
  // otherwise just redirect to confirm page with token and email(base64url encoded) in query param
  return await pipe(
    flowChoice,
    TE.fromPredicate(
      flow => flow === FlowTypeEnum.VALIDATE,
      () =>
        ResponseSeeOtherRedirect(
          confirmChoicePageUrl(confirmValidationUrl, token, email)
        )
    ),
    TE.chain(() =>
      pipe(
        profileModel.update({
          ...existingProfile,
          isEmailValidated: true
        }),
        TE.mapLeft(error => {
          context.log.error(
            `${logPrefix}|Error updating profile|ERROR=${error}`
          );
          return ResponseSeeOtherRedirect(
            vFailureUrl(ValidationErrors.GENERIC_ERROR)
          );
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
          return ResponseSeeOtherRedirect(
            validationSuccessUrl(validationCallbackUrl)
          );
        })
      )
    ),
    TE.toUnion
  )();
};

/**
 * Wraps a ValidateProfileEmail handler inside an Express request handler.
 */

export const ValidateProfileEmail = (
  tableClient: TableClient,
  profileModel: ProfileModel,
  emailValidationUrls: {
    readonly confirmValidationUrl: ValidUrl;
    readonly validationCallbackUrl: ValidUrl;
  },
  profileEmails: IProfileEmailReader
): express.RequestHandler => {
  const handler = ValidateProfileEmailHandler(
    tableClient,
    profileModel,
    emailValidationUrls,
    profileEmails
  );

  const middlewaresWrap = withRequestMiddlewares(
    ContextMiddleware(),
    TokenQueryParamMiddleware,
    ConfirmEmailFlowQueryParamMiddleware
  );
  return wrapRequestHandler(middlewaresWrap(handler));
};
