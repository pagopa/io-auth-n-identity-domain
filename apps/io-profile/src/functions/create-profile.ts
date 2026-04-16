import { InvocationContext } from "@azure/functions";
import * as df from "durable-functions";

import { isLeft } from "fp-ts/lib/Either";
import * as TE from "fp-ts/lib/TaskEither";

import {
  IResponseErrorConflict,
  IResponseSuccessJson,
  ResponseErrorConflict,
  ResponseSuccessJson,
} from "@pagopa/ts-commons/lib/responses";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";

import { ExtendedProfile } from "@pagopa/io-functions-commons/dist/generated/definitions/ExtendedProfile";
import { NewProfile } from "@pagopa/io-functions-commons/dist/generated/definitions/NewProfile";
import {
  NewProfile as INewProfile,
  ProfileModel,
} from "@pagopa/io-functions-commons/dist/src/models/profile";
import { CosmosDecodingError } from "@pagopa/io-functions-commons/dist/src/utils/cosmosdb_model";
import { wrapHandlerV4 } from "@pagopa/io-functions-commons/dist/src/utils/azure-functions-v4-express-adapter";
import { ContextMiddleware } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/context_middleware";
import { FiscalCodeMiddleware } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/fiscalcode";

import {
  IResponseErrorQuery,
  ResponseErrorQuery,
} from "@pagopa/io-functions-commons/dist/src/utils/response";

import { isBefore } from "date-fns";
import { pipe } from "fp-ts/lib/function";
import { fromEither } from "fp-ts/lib/TaskEither";
import { NewProfileMiddleware } from "../utils/middlewares/profile";
import { retrievedProfileToExtendedProfile } from "../utils/profiles";
import { OrchestratorInput as UpsertedProfileOrchestratorInput } from "./upserted-profile-orchestrator";

/**
 * Type of an CreateProfile handler.
 */
type ICreateProfileHandler = (
  context: InvocationContext,
  fiscalCode: FiscalCode,
  NewProfile: NewProfile,
) => Promise<
  | IResponseSuccessJson<ExtendedProfile>
  | IResponseErrorQuery
  | IResponseErrorConflict
>;

export function CreateProfileHandler(
  profileModel: ProfileModel,
  optOutEmailSwitchDate: Date,
): ICreateProfileHandler {
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  return async (context, fiscalCode, createProfilePayload) => {
    const logPrefix = `CreateProfileHandler|FISCAL_CODE=${fiscalCode}`;

    const errorOrCreatedProfile = await pipe(
      fromEither(
        INewProfile.decode({
          email: createProfilePayload.email,
          fiscalCode,
          // this check can be removed after the release date for optOutEmailSwitchDate
          isEmailEnabled: isBefore(new Date(), optOutEmailSwitchDate),
          isEmailValidated: createProfilePayload.is_email_validated,
          isInboxEnabled: false,
          isTestProfile: createProfilePayload.is_test_profile,
          isWebhookEnabled: false,
          kind: "INewProfile",
        }),
      ),
      TE.mapLeft(CosmosDecodingError),
      TE.chain((newProfile) => profileModel.create(newProfile)),
    )();

    if (isLeft(errorOrCreatedProfile)) {
      const failure = errorOrCreatedProfile.left;

      context.error(`${logPrefix}|ERROR=${failure.kind}`);

      // Conflict, resource already exists
      if (
        failure.kind === "COSMOS_ERROR_RESPONSE" &&
        failure.error.code === 409
      ) {
        return ResponseErrorConflict(
          "A profile with the requested fiscal_code already exists",
        );
      }

      return ResponseErrorQuery("Error while creating a new profile", failure);
    }

    const createdProfile = errorOrCreatedProfile.right;

    // Start the Orchestrator
    const upsertedProfileOrchestratorInput =
      UpsertedProfileOrchestratorInput.encode({
        newProfile: createdProfile,
        updatedAt: new Date(),
      });

    const dfClient = df.getClient(context);
    await dfClient.startNew(
      "UpsertedProfileOrchestrator",
      { input: upsertedProfileOrchestratorInput },
    );

    return ResponseSuccessJson(
      retrievedProfileToExtendedProfile(createdProfile),
    );
  };
}

export function CreateProfile(
  profileModel: ProfileModel,
  optOutEmailSwitchDate: Date,
) {
  const handler = CreateProfileHandler(profileModel, optOutEmailSwitchDate);
  const middlewares = [
    ContextMiddleware(),
    FiscalCodeMiddleware,
    NewProfileMiddleware,
  ] as const;
  return wrapHandlerV4(middlewares, handler);
}
