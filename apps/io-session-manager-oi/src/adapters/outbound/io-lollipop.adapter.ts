import {
  ConflictError,
  ForbiddenError,
  GenericError,
  NotFoundError,
} from "@pagopa/hexagonal-core";
import { err, ok } from "neverthrow";

import { LollipopPort } from "../../domain/ports/outbound/lollipop.port.js";
import { createClient } from "../../generated/io-lollipop/client/index.js";
import {
  activatePubKey,
  generateLcParams,
  reservePubKey,
} from "../../generated/io-lollipop/sdk.gen.js";
import type {
  ActivatePubKeyErrors,
  ActivatePubKeyResponses,
  GenerateLcParamsErrors,
  GenerateLcParamsResponses,
  ReservePubKeyErrors,
  ReservePubKeyResponses,
} from "../../generated/io-lollipop/types.gen.js";

import { LcParamsDto } from "./dtos/io-lollipop.dto.js";

export const createIoLollipopAdapter = (config: {
  baseUrl: string;
  apiKey: string;
}): LollipopPort => {
  const client = createClient({
    baseUrl: config.baseUrl,
    headers: {
      "X-Functions-Key": config.apiKey,
    },
  });

  return {
    reservePubKey: async (payload) => {
      const { response } = await reservePubKey({
        client,
        body: {
          algo: payload.algo,
          pub_key: JSON.stringify(payload.pub_key),
        },
      });

      const status = response?.status as
        | keyof ReservePubKeyResponses
        | keyof ReservePubKeyErrors;
      switch (status) {
        case 201:
          return ok(undefined);
        case 400:
        case 403:
        case 500:
          return err(new GenericError("Cannot reserve pubKey"));
        case 409:
          return err(new ConflictError("PubKey is already reserved"));
        default:
          // exhaustive check for all possible status codes
          const _exhaustiveCheck: never = status;
          return err(
            new GenericError(
              `Unexpected error from io-lollipop. Status: ${response?.status ?? "unknown"}`,
            ),
          );
      }
    },

    activatePubKey: async (assertionRef, payload) => {
      const { response } = await activatePubKey({
        client,
        path: { assertion_ref: assertionRef },
        body: {
          ...payload,
          expired_at: payload.expired_at.toISOString(),
        },
      });

      const status = response?.status as
        | keyof ActivatePubKeyResponses
        | keyof ActivatePubKeyErrors;
      switch (status) {
        case 200:
          return ok(assertionRef);
        case 400:
        case 403:
        case 500:
          return err(
            new GenericError(
              "Error calling the function lollipop api for pubkey activation",
            ),
          );
        default:
          // exhaustive check for all possible status codes
          const _exhaustiveCheck: never = status;
          return err(
            new GenericError(
              `Unexpected error from io-lollipop. Status: ${response?.status ?? "unknown"}`,
            ),
          );
      }
    },

    generateLCParams: async (assertionRef, payload) => {
      const { data, response } = await generateLcParams({
        client,
        path: { assertion_ref: assertionRef },
        body: payload,
      });

      const status = response?.status as
        | keyof GenerateLcParamsResponses
        | keyof GenerateLcParamsErrors;
      switch (status) {
        case 200: {
          const parsed = LcParamsDto.safeParse(data);
          return parsed.success
            ? ok(parsed.data)
            : err(
                new GenericError(
                  `Invalid generateLCParams response: ${parsed.error.message}`,
                ),
              );
        }
        case 403:
          return err(new ForbiddenError());
        case 404:
          return err(new NotFoundError("LcParams", "Not Found"));
        case 400:
        case 500:
          return err(new GenericError("An error occurred on upstream service"));
        default:
          // exhaustive check for all possible status codes
          const _exhaustiveCheck: never = status;
          return err(
            new GenericError(
              `Unexpected error from io-lollipop. Status: ${response?.status ?? "unknown"}`,
            ),
          );
      }
    },
  };
};
