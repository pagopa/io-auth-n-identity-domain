import {
  IResponseErrorInternal,
  IResponseErrorTooManyRequests,
  IResponseErrorNotFound,
  IResponseSuccessJson,
  ResponseSuccessJson,
  ResponseErrorNotFound,
  ResponseErrorTooManyRequests,
  ResponseErrorInternal,
  IResponseErrorConflict,
  ResponseErrorConflict,
} from "@pagopa/ts-commons/lib/responses";
import { ExtendedProfile as ExtendedProfileApi } from "@pagopa/io-functions-app-sdk/ExtendedProfile";
import * as TE from "fp-ts/TaskEither";
import * as E from "fp-ts/Either";
import * as RTE from "fp-ts/ReaderTaskEither";
import { pipe } from "fp-ts/lib/function";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import { NewProfile } from "@pagopa/io-functions-app-sdk/NewProfile";
import {
  unhandledResponseStatus,
  withValidatedOrInternalError,
  withValidatedOrInternalErrorRTE,
} from "../utils/responses";
import { FnAppRepo } from "../repositories";
import { toInitializedProfile } from "../types/profile";
import { InitializedProfile } from "../generated/backend/InitializedProfile";
import { WithUser } from "../utils/user";
import { SpidUser, User } from "../types/user";

/**
 * Retrieves the profile for a specific user converting an `ExtendedProfile`
 * obtained from the Fn App API Client to an `InitializedProfile`
 * @param dependencies The fn-app Client and the user data related to the session
 * @returns Responses
 */
export const getProfile: RTE.ReaderTaskEither<
  FnAppRepo.FnAppAPIRepositoryDeps & WithUser,
  Error,
  | IResponseErrorInternal
  | IResponseErrorTooManyRequests
  | IResponseErrorNotFound
  | IResponseSuccessJson<InitializedProfile>
> = ({ fnAppAPIClient, user }) =>
  TE.tryCatch(
    async () => {
      const validated = await fnAppAPIClient.getProfile({
        fiscal_code: user.fiscal_code,
      });

      return withValidatedOrInternalError(validated, (response) => {
        if (response.status === 200) {
          // we need an ExtendedProfile (and that's what we should have got) but
          // since the response may be an ExtendedProfile or a LimitedProfile
          // depending on the credentials, we must decode it as an
          // ExtendedProfile to be sure it's what we need.
          const validatedExtendedProfile = ExtendedProfileApi.decode(
            response.value,
          );

          return withValidatedOrInternalError(validatedExtendedProfile, (p) =>
            ResponseSuccessJson(toInitializedProfile(p, user)),
          );
        }

        if (response.status === 404) {
          return ResponseErrorNotFound("Not Found", "Profile not found");
        }

        // The user has sent too many requests in a given amount of time ("rate limiting").
        if (response.status === 429) {
          return ResponseErrorTooManyRequests();
        }

        if (response.status === 500) {
          return ResponseErrorInternal(
            `Error retrieving the profile [${response.value.detail}]`,
          );
        }

        return unhandledResponseStatus(response.status);
      });
    },
    (err) => new Error(`An Error occurs calling the getProfile API: [${err}]`),
  );

export type CreateNewProfileDependencies = {
  testLoginFiscalCodes: ReadonlyArray<FiscalCode>;
  isSpidEmailPersistenceEnabled: boolean;
};

export const createProfile: (
  user: User,
  spidUser: SpidUser,
) => RTE.ReaderTaskEither<
  FnAppRepo.FnAppAPIRepositoryDeps & CreateNewProfileDependencies,
  Error,
  | IResponseErrorInternal
  | IResponseErrorTooManyRequests
  | IResponseErrorConflict
  // This Service response is not binded with any API response, so we remove any payload
  // from this Response Success JSON.
  | IResponseSuccessJson<NewProfile>
> = (user, spidUser) => (deps) => {
  // --------------------
  // set isEmailValidated true if there is a SPID email and the emailPersistance
  // switch is on, otherwhise set false.
  const isEmailValidated =
    deps.isSpidEmailPersistenceEnabled && spidUser.email ? true : false;
  // --------------------
  const isTestProfile = deps.testLoginFiscalCodes.includes(user.fiscal_code);
  const newProfile = {
    email: deps.isSpidEmailPersistenceEnabled ? spidUser.email : undefined,
    is_email_validated: isEmailValidated,
    is_test_profile: isTestProfile,
  };

  return pipe(
    TE.tryCatch(
      () =>
        deps.fnAppAPIClient.createProfile({
          body: newProfile,
          fiscal_code: user.fiscal_code,
        }),
      E.toError,
    ),
    TE.chain((validated) =>
      withValidatedOrInternalErrorRTE(validated, (response) =>
        TE.of(
          response.status === 200
            ? // An empty response.
              ResponseSuccessJson(newProfile)
            : response.status === 409
              ? ResponseErrorConflict(
                  response.value ||
                    "A user with the provided fiscal code already exists",
                )
              : response.status === 429
                ? ResponseErrorTooManyRequests()
                : unhandledResponseStatus(response.status),
        ),
      ),
    ),
  );
};
