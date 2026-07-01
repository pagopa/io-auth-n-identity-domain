import { ResultAsync } from "neverthrow";
import ky, { HTTPError } from "ky";
import { LollipopClientI } from "../../domain/ports/outbound/lollipopClient.js";
import { ConflictError, GenericError } from "@pagopa/hexagonal-core";

export const makeKyLollipopClientAdapter = (
  kyInstance: typeof ky,
  baseUrl: string,
  basePath: string,
  apiKey: string,
): LollipopClientI => {
  return {
    reserveLollipopKey: (algo, jwkPubKey) => {
      const url = `${baseUrl}${basePath.replace(/\/$/, "")}/pubkeys`;

      return ResultAsync.fromPromise(
        kyInstance.post(url, {
          json: {
            pub_key: jwkPubKey,
            algo: algo,
          },
          headers: {
            "X-Functions-Key": apiKey,
          },
        }),
        (error) => {
          if (error instanceof HTTPError) {
            if (error.response.status === 409) {
              return new ConflictError("The public key is already reserved.");
            }
            return new GenericError(
              `Failed to reserve key. Status: ${error.response.status} ${error.response.statusText}`,
            );
          }

          const errorMessage =
            error instanceof Error ? error.message : "Unknown network error";
          return new GenericError(
            `Network error while calling reserve endpoint: ${errorMessage}`,
          );
        },
      ).map(() => undefined);
    },
  };
};
