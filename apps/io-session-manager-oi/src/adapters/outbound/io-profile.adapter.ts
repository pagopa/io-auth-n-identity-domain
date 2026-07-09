import {
  ConflictError,
  FiscalCode,
  GenericError,
  NotFoundError,
} from "@pagopa/hexagonal-core";
import { err, ok, type Result } from "neverthrow";

import { type UserProfile } from "../../domain/entities/profile.entity.js";
import type { ProfilePort } from "../../domain/ports/outbound/profile.port.js";
import { createClient } from "../../generated/io-profile/client/index.js";
import {
  createProfile,
  getProfile,
} from "../../generated/io-profile/sdk.gen.js";
import type {
  CreateProfileErrors,
  CreateProfileResponses,
  GetProfileErrors,
  GetProfileResponses,
} from "../../generated/io-profile/types.gen.js";
import { zGetProfileResponse } from "../../generated/io-profile/zod.gen.js";

// Restricted profile schema used to validate the response from io-profile service within the session domain.
const RestrictedUserProfileSchema = zGetProfileResponse.pick({
  email: true,
  is_email_validated: true,
});

export const createGetProfileAdapter = (config: {
  baseUrl: string;
  apiKey: string;
}): ProfilePort => {
  const client = createClient({
    baseUrl: config.baseUrl,
    headers: {
      "X-Functions-Key": config.apiKey,
    },
  });

  return {
    getProfile: async (
      fiscalCode: FiscalCode,
    ): Promise<Result<UserProfile, NotFoundError | GenericError>> => {
      const { data, response } = await getProfile({
        client,
        path: { fiscal_code: fiscalCode },
      });

      const status = response?.status as
        | keyof GetProfileResponses
        | keyof GetProfileErrors;

      switch (status) {
        case 200: {
          const parsed = RestrictedUserProfileSchema.safeParse(data);
          if (!parsed.success) {
            return err(
              new GenericError(
                `Invalid profile response: ${parsed.error.message}`,
              ),
            );
          }
          const userProfile: UserProfile = {
            fiscalCode,
            email: parsed.data.email,
            isEmailValidated: parsed.data.is_email_validated,
          };
          return ok(userProfile);
        }
        case 400:
          return err(new GenericError("Invalid request to io-profile"));
        case 401:
          return err(new GenericError("Unauthorized request to io-profile"));
        case 404:
          return err(
            new NotFoundError("Profile", "Profile not found in io-profile"),
          );
        case 429:
          return err(new GenericError("Too many requests to io-profile"));
        case 500:
          return err(new GenericError("Internal server error from io-profile"));
        default: {
          // exhaustive check for all possible status codes
          const _exhaustiveCheck: never = status;
          return err(
            new GenericError(`Unexpected error from io-profile: ${status}`),
          );
        }
      }
    },
    create: async (
      newProfile: UserProfile,
    ): Promise<Result<UserProfile, ConflictError | GenericError>> => {
      const { data, response } = await createProfile({
        client,
        path: { fiscal_code: newProfile.fiscalCode },
        body: {
          email: newProfile.email,
          is_email_validated: newProfile.isEmailValidated,
        },
      });

      const status = response?.status as
        | keyof CreateProfileResponses
        | keyof CreateProfileErrors;

      switch (status) {
        case 200: {
          const parsed = RestrictedUserProfileSchema.safeParse(data);
          if (!parsed.success) {
            return err(
              new GenericError(
                `Invalid profile response: ${parsed.error.message}`,
              ),
            );
          }
          const userProfile: UserProfile = {
            fiscalCode: newProfile.fiscalCode,
            email: parsed.data.email,
            isEmailValidated: parsed.data.is_email_validated,
          };
          return ok(userProfile);
        }
        case 400:
          return err(new GenericError("Invalid request to io-profile"));
        case 401:
          return err(new GenericError("Unauthorized request to io-profile"));
        case 409:
          return err(new ConflictError("Profile already exists in io-profile"));
        case 429:
          return err(new GenericError("Too many requests to io-profile"));
        default: {
          const _exhaustiveCheck: never = status;
          return err(
            new GenericError(`Unexpected error from io-profile: ${status}`),
          );
        }
      }
    },
  };
};
