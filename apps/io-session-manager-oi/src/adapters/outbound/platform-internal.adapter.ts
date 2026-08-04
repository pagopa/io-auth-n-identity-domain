import { GenericError } from "@pagopa/hexagonal-core";
import { err, ok } from "neverthrow";

import type { PlatformInternalPort } from "../../domain/ports/outbound/platform-internal.port.js";
import { createClient } from "../../generated/platform-internal/client/index.js";
import { deleteSession } from "../../generated/platform-internal/sdk.gen.js";
import type {
  DeleteSessionErrors,
  DeleteSessionResponses,
} from "../../generated/platform-internal/types.gen.js";

export const createPlatformInternalAdapter = (config: {
  baseUrl: string;
  apiKey: string;
}): PlatformInternalPort => {
  const client = createClient({
    baseUrl: config.baseUrl,
    headers: {
      "X-Functions-Key": config.apiKey,
    },
  });

  return {
    deleteSession: async (sessionToken) => {
      const { response } = await deleteSession({
        client,
        headers: {
          "X-Session-Token": sessionToken,
        },
      });

      const status = response?.status as
        | keyof DeleteSessionResponses
        | keyof DeleteSessionErrors;

      switch (status) {
        case 204:
          return ok(void 0);
        case 400:
          return err(new GenericError("Invalid request to platform-internal"));
        case 401:
          return err(
            new GenericError("Unauthorized request to platform-internal"),
          );
        case 429:
          return err(
            new GenericError("Too many requests to platform-internal"),
          );
        case 500:
          return err(
            new GenericError("Internal server error from platform-internal"),
          );
        default: {
          // exhaustive check for all possible status codes
          const _exhaustiveCheck: never = status;
          return err(
            new GenericError(
              `Unexpected error from platform-internal: ${status}`,
            ),
          );
        }
      }
    },
  };
};
