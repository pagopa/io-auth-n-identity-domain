import { err, ResultAsync } from "neverthrow";
import ky, { HTTPError, SchemaValidationError } from "ky";
import { ProfileClientI } from "../../domain/ports/outbound/profile-client.js";
import {
  AuthenticationError,
  ConflictError,
  FiscalCode,
  GenericError,
  NotFoundError,
  TooManyRequestsError,
  ValidationError,
} from "@pagopa/hexagonal-core";
import {
  ExtendedProfileSchema,
  NewProfile,
} from "../../domain/value-objects/profile/profile.value-object.js";
import z from "zod";

export const makeProfileKyClientAdapter = (
  kyInstance: typeof ky,
  baseUrl: string,
  basePath: string,
  apiKey: string,
): ProfileClientI => {
  const cleanBasePath = basePath.replace(/\/$/, "");
  const baseNormalizedUrl = `${baseUrl}${cleanBasePath}`;

  return {
    getProfile: (fiscalCode: FiscalCode) => {
      const url = `${baseNormalizedUrl}/${fiscalCode}`;

      return ResultAsync.fromPromise(
        kyInstance
          .get(url, {
            headers: {
              "X-Functions-Key": apiKey,
            },
          })
          .json<ExtendedProfileSchema>(),
        (error) => {
          if (error instanceof HTTPError) {
            switch (error.response.status) {
              case 400:
                return new ValidationError("Bad Request");
              case 401:
                return new AuthenticationError();
              case 404:
                return new NotFoundError("Profile", "Profile not found");
              case 429:
                return new TooManyRequestsError();
              default:
                return new GenericError(
                  `Failed to get profile. Status: ${error.response.status} ${error.response.statusText}`,
                );
            }
          } else if (error instanceof SchemaValidationError) {
            return new GenericError(
              `Decoding error from response: ${z.prettifyError(error)}`,
            );
          }

          const errorMessage =
            error instanceof Error ? error.message : "Unknown network error";
          return new GenericError(
            `Network error while calling getProfile endpoint: ${errorMessage}`,
          );
        },
      );
    },

    createProfile: (payload: NewProfile) => {
      const url = baseNormalizedUrl;

      return ResultAsync.fromPromise(
        kyInstance
          .post(url, {
            json: payload,
            headers: {
              "X-Functions-Key": apiKey,
            },
          })
          .json<ExtendedProfileSchema>(),
        (error) => {
          if (error instanceof HTTPError) {
            switch (error.response.status) {
              case 400:
                return new ValidationError("Bad Request");
              case 401:
                return new AuthenticationError();
              case 409:
                return new ConflictError("The profile already exists.");
              case 429:
                return new TooManyRequestsError();
              default:
                return new GenericError(
                  `Failed to create profile. Status: ${error.response.status} ${error.response.statusText}`,
                );
            }
          } else if (error instanceof SchemaValidationError) {
            return new GenericError(
              `Decoding error from response: ${z.prettifyError(error)}`,
            );
          }

          const errorMessage =
            error instanceof Error ? error.message : "Unknown network error";
          return new GenericError(
            `Network error while calling createProfile endpoint: ${errorMessage}`,
          );
        },
      );
    },
  };
};
