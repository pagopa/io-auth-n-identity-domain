import {
  GenericError,
  NonEmptyString,
  NotFoundError,
} from "@pagopa/hexagonal-core";
import { err, ok } from "neverthrow";

import { SmInternalRolloutPort } from "../../domain/ports/outbound/sm-internal-rollout.port.js";
import { createClient } from "../../generated/io-session-manager-internal/client/index.js";
import {
  getUserLollipopActivation,
  softDeleteUserSession,
} from "../../generated/io-session-manager-internal/sdk.gen.js";
import type {
  GetUserLollipopActivationErrors,
  GetUserLollipopActivationResponses,
  SoftDeleteUserSessionErrors,
  SoftDeleteUserSessionResponses,
} from "../../generated/io-session-manager-internal/types.gen.js";

import { LollipopActivationDto } from "./dtos/sm-internal-rollout.dto.js";

export const createSmInternalRolloutAdapter = (config: {
  baseUrl: URL;
  apiKey: NonEmptyString;
}): SmInternalRolloutPort => {
  const client = createClient({
    baseUrl: config.baseUrl.href,
    headers: {
      "X-Functions-Key": config.apiKey, // TODO: try to use auth property instead of explicit header if possible
    },
  });

  return {
    softDeleteUserSession: async (fiscalCode) => {
      const { response } = await softDeleteUserSession({
        client,
        path: { fiscalCode },
      });

      const status = response?.status as
        | keyof SoftDeleteUserSessionResponses
        | keyof SoftDeleteUserSessionErrors;
      switch (status) {
        case 204:
          return ok(undefined);
        case 400:
        case 401:
        case 500:
          return err(new GenericError("Cannot soft delete user session"));
        default: {
          // exhaustive check for all possible status codes
          const _exhaustiveCheck: never = status;
          return err(
            new GenericError(
              `Unexpected error from io-session-manager-internal. Status: ${response?.status ?? "unknown"}`,
            ),
          );
        }
      }
    },

    getUserLollipopActivation: async (fiscalCode) => {
      const { data, response } = await getUserLollipopActivation({
        client,
        path: { fiscalCode },
      });

      const status = response?.status as
        | keyof GetUserLollipopActivationResponses
        | keyof GetUserLollipopActivationErrors;
      switch (status) {
        case 200: {
          const parsed = LollipopActivationDto.safeParse(data);
          return parsed.success
            ? ok(parsed.data.assertion_ref)
            : err(
                new GenericError(
                  `Invalid getUserLollipopActivation response: ${parsed.error.message}`,
                ),
              );
        }
        case 404:
          return err(
            new NotFoundError("LollipopActivation", "Activation Not Found"),
          );
        case 400:
        case 401:
        case 500:
          return err(
            new GenericError("Cannot retrieve user lollipop activation"),
          );
        default:
          // exhaustive check for all possible status codes
          const _exhaustiveCheck: never = status;
          return err(
            new GenericError(
              `Unexpected error from io-session-manager-internal. Status: ${response?.status ?? "unknown"}`,
            ),
          );
      }
    },
  };
};
