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
import { User } from "../types/user";
import {
  unhandledResponseStatus,
  withCatchAsInternalError,
  withValidatedOrInternalError,
} from "../utils/responses";
import { FnAppAPIClient } from "../repositories/api";
import { toInitializedProfile } from "../types/profile";
import { InitializedProfile } from "../generated/backend/InitializedProfile";

export const getProfile =
  (apiClient: ReturnType<FnAppAPIClient>) =>
  (
    user: User,
  ): Promise<
    | IResponseErrorInternal
    | IResponseErrorTooManyRequests
    | IResponseErrorNotFound
    | IResponseSuccessJson<InitializedProfile>
  > =>
    withCatchAsInternalError(async () => {
      const validated = await apiClient.getProfile({
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
    });
