import { AuthenticationError, GenericError } from "@pagopa/hexagonal-core";
import { err, ok } from "neverthrow";

import { FastLoginPort } from "../../domain/ports/outbound/fast-login.port.js";
import { createClient } from "../../generated/io-fast-login/client/client.gen.js";
import { fastLogin } from "../../generated/io-fast-login/sdk.gen.js";
import {
  FastLoginErrors,
  FastLoginResponses,
} from "../../generated/io-fast-login/types.gen.js";

import { FastLoginResponseDto } from "./dtos/io-fast-login.dto.js";

export const createIoFastLoginAdapter = (config: {
  baseUrl: string;
  apiKey: string;
}): FastLoginPort => {
  const client = createClient({
    baseUrl: config.baseUrl,
    headers: {
      "X-Functions-Key": config.apiKey,
    },
  });

  return {
    fastLogin: async (payload) => {
      const { response, data } = await fastLogin({
        client,
        headers: {
          "x-pagopa-lollipop-assertion-ref": payload.assertionRef,
          "x-pagopa-lollipop-assertion-type": payload.assertionType,
          "x-pagopa-lollipop-auth-jwt": payload.authJWT,
          "x-pagopa-lollipop-original-method": payload.originalMethod,
          "x-pagopa-lollipop-original-url": payload.originalUrl,
          "x-pagopa-lollipop-public-key": payload.publicKey,
          "x-pagopa-lollipop-user-id": payload.userId,
          "x-pagopa-lv-client-ip": payload.clientIp,
          signature: payload.signature,
          "signature-input": payload.signatureInput,
        },
      });

      const status = response?.status as
        | keyof FastLoginResponses
        | keyof FastLoginErrors;
      switch (status) {
        case 200: {
          const parsed = FastLoginResponseDto.safeParse(data);
          return parsed.success
            ? ok(parsed.data.saml_response)
            : err(
                new GenericError(
                  `Invalid fastLogin response: ${parsed.error.message}`,
                ),
              );
        }
        case 401:
          return err(new AuthenticationError());
        case 400:
        case 500:
          return err(new GenericError("Error while calling fastLogin"));
        default:
          // exhaustive check for all possible status codes
          const _exhaustiveCheck: never = status;
          return err(
            new GenericError(
              `Unexpected error from io-fast-login. Status: ${response?.status ?? "unknown"}`,
            ),
          );
      }
    },
  };
};
