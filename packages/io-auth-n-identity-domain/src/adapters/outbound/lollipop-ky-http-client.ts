import {
  ConflictError,
  ForbiddenError,
  GenericError,
  NotFoundError,
  ValidationError,
} from "@pagopa/hexagonal-core";
import ky, { HTTPError, SchemaValidationError } from "ky";
import { ResultAsync } from "neverthrow";
import z from "zod";

import {
  ActivatePubKeyPayloadSchema,
  ActivatedPubKeySchema,
  GenerateLcParamsPayloadSchema,
  LcParamsSchema,
  NewPubKeyPayloadSchema,
  NewPubKeySchema,
} from "../../domain/entities/lollipop/lollipop-pub-key.entity.js";
import { LollipopClientI } from "../../domain/ports/outbound/lollipop-client.js";
import { LollipopAssertionRef } from "../../domain/value-objects/lollipop/lollipop-assertion-ref.value-object.js";

const toNetworkError = (
  error: unknown,
  operationName: string,
): GenericError => {
  if (error instanceof SchemaValidationError) {
    return new GenericError(
      `Decoding error from response: ${z.prettifyError(error)}`,
    );
  }

  const errorMessage =
    error instanceof Error ? error.message : "Unknown network error";
  return new GenericError(
    `Network error while calling ${operationName} endpoint: ${errorMessage}`,
  );
};

export const makeLollipopKyClientAdapter = (
  kyInstance: typeof ky,
  baseUrl: string,
  basePath: string,
  apiKey: string,
): LollipopClientI => {
  const cleanBasePath = basePath.replace(/\/$/, "");
  const baseNormalizedUrl = `${baseUrl}${cleanBasePath}`;

  return {
    reservePubKey: (payload: NewPubKeyPayloadSchema) => {
      const url = `${baseNormalizedUrl}/pubkeys`;

      return ResultAsync.fromPromise(
        kyInstance
          .post(url, {
            json: payload,
            headers: {
              "X-Functions-Key": apiKey,
            },
          })
          .json(NewPubKeySchema),
        (error) => {
          if (error instanceof HTTPError) {
            switch (error.response.status) {
              case 400:
                return new ValidationError("Bad Request");
              case 403:
                return new ForbiddenError();
              case 409:
                return new ConflictError("The pub key is already reserved.");
              default:
                return new GenericError(
                  `Failed to reserve pub key. Status: ${error.response.status} ${error.response.statusText}`,
                );
            }
          }

          return toNetworkError(error, "reservePubKey");
        },
      );
    },

    activatePubKey: (
      assertionRef: LollipopAssertionRef,
      payload: ActivatePubKeyPayloadSchema,
    ) => {
      const url = `${baseNormalizedUrl}/pubKeys/${assertionRef}`;

      return ResultAsync.fromPromise(
        kyInstance
          .put(url, {
            json: payload,
            headers: {
              "X-Functions-Key": apiKey,
            },
          })
          .json(ActivatedPubKeySchema),
        (error) => {
          if (error instanceof HTTPError) {
            switch (error.response.status) {
              case 400:
                return new ValidationError("Bad Request");
              case 403:
                return new ForbiddenError();
              default:
                return new GenericError(
                  `Failed to activate pub key. Status: ${error.response.status} ${error.response.statusText}`,
                );
            }
          }

          return toNetworkError(error, "activatePubKey");
        },
      );
    },

    generateLCParams: (
      assertionRef: LollipopAssertionRef,
      payload: GenerateLcParamsPayloadSchema,
    ) => {
      const url = `${baseNormalizedUrl}/pubKeys/${assertionRef}/generate`;

      return ResultAsync.fromPromise(
        kyInstance
          .post(url, {
            json: payload,
            headers: {
              "X-Functions-Key": apiKey,
            },
          })
          .json(LcParamsSchema),
        (error) => {
          if (error instanceof HTTPError) {
            switch (error.response.status) {
              case 400:
                return new ValidationError("Bad Request");
              case 403:
                return new ForbiddenError();
              case 404:
                return new NotFoundError("PubKey", "PubKey not found");
              default:
                return new GenericError(
                  `Failed to generate LC params. Status: ${error.response.status} ${error.response.statusText}`,
                );
            }
          }

          return toNetworkError(error, "generateLCParams");
        },
      );
    },
  };
};
