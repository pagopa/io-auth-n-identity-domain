import { err, ok, ResultAsync } from "neverthrow";
import { LollipopClientI } from "../../domain/ports/outbound/lollipopClient.js";
import { ConflictError, GenericError } from "@pagopa/hexagonal-core";

export const makeFetchLollipopClientAdapter = (
  baseUrl: string,
  basePath: string,
  apiKey: string,
): LollipopClientI => {
  return {
    reserveLollipopKey: (algo, jwkPubKey) => {
      const url = `${baseUrl}${basePath.replace(/\/$/, "")}/pubkeys`;
      return ResultAsync.fromPromise(
        fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Functions-Key": apiKey,
          },
          body: JSON.stringify({
            pub_key: jwkPubKey,
            algo: algo,
          }),
        }),
        (error) => {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown network error";
          return new GenericError(
            `Network error while calling reserve endpoint: ${errorMessage}`,
          );
        },
      ).andThen((response) => {
        if (response.ok) {
          return ok(undefined);
        }

        if (response.status === 409) {
          return err(new ConflictError("The public key is already reserved."));
        }

        return err(
          new GenericError(
            `Failed to reserve key. Status: ${response.status} ${response.statusText}`,
          ),
        );
      });
    },
  };
};
