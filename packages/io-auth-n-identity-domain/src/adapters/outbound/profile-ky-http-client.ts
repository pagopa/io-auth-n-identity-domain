import {
  AuthenticationError,
  ConflictError,
  FiscalCode,
  GenericError,
  NotFoundError,
  TooManyRequestsError,
  ValidationError,
} from "@pagopa/hexagonal-core";
import ky, { HTTPError, SchemaValidationError } from "ky";
import { ResultAsync } from "neverthrow";
import z from "zod";
import { ProfileClient } from "../../domain/ports/outbound/profile-client.js";
import { StandardSchemaV1 } from "@standard-schema/spec";

export const makeProfileKyClientAdapter = <
  DomainSchema extends StandardSchemaV1,
>(
  kyInstance: typeof ky,
  baseUrl: string,
  basePath: string,
  apiKey: string,
  zodschema: DomainSchema,
): ProfileClient<DomainSchema> => {
  const cleanBasePath = basePath.replace(/\/$/, "");
  const baseNormalizedUrl = `${baseUrl}${cleanBasePath}`;

  return {
    getProfile: (fiscalCode: FiscalCode) => {
      const url = `${baseNormalizedUrl}/profiles/${fiscalCode}`;

      return ResultAsync.fromPromise(
        kyInstance
          .get(url, {
            headers: {
              "X-Functions-Key": apiKey,
            },
          })
          .json(zodschema),
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

    createProfile: (fiscalCode, payload) => {
      const url = `${baseNormalizedUrl}/profiles/${fiscalCode}`;

      return ResultAsync.fromPromise(
        kyInstance
          .post(url, {
            json: payload,
            headers: {
              "X-Functions-Key": apiKey,
            },
          })
          .json(zodschema),
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
