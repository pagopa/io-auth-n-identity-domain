import {
  IResponseErrorInternal,
  IResponseErrorTooManyRequests,
  IResponseErrorNotFound,
  IResponseSuccessJson,
  ResponseSuccessJson,
  ResponseErrorNotFound,
  ResponseErrorTooManyRequests,
  ResponseErrorInternal,
} from "@pagopa/ts-commons/lib/responses";
import { ExtendedProfile as ExtendedProfileApi } from "@pagopa/io-functions-app-sdk/ExtendedProfile";
import * as TE from "fp-ts/TaskEither";
import * as RTE from "fp-ts/ReaderTaskEither";
import {
  unhandledResponseStatus,
  withValidatedOrInternalError,
} from "../utils/responses";
import { FnAppRepo } from "../repositories";
import { toInitializedProfile } from "../types/profile";
import { InitializedProfile } from "../generated/backend/InitializedProfile";
import { WithUser } from "../utils/user";

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
