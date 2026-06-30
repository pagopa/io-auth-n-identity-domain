import { LollipopJwk } from "@pagopa/io-auth-n-identity-domain";
import { ConflictError, GenericError } from "@pagopa/io-core-domain/errors";
import { err, ok, Result } from "neverthrow";

import type { LollipopConfig } from "../../domain/entities/config.entity.js";
import { LollipopPublicKeySchema } from "../../domain/entities/lollipop-public-key.entity.js";
import type { LollipopOutboundPort } from "../../domain/ports/outbound/lollipop.outbound-port.js";

const decodeJwk = (encodedPubKey: LollipopJwk) => {
  try {
    return ok(
      JSON.parse(Buffer.from(encodedPubKey, "base64url").toString("utf-8")),
    );
  } catch {
    return err(new GenericError("Failed to decode JWK"));
  }
};

export const createLollipopAdapter = (
  config: LollipopConfig,
): LollipopOutboundPort => ({
  healthcheck: async () => {
    let response: Response;

    try {
      response = await fetch(
        `${config.LOLLIPOP_API_URL}${config.LOLLIPOP_API_BASE_PATH}/api/info`,
      );
    } catch (e) {
      return err(
        new GenericError(
          `Failed to reach lollipop healthcheck endpoint: ${e instanceof Error ? e.message : String(e)}`,
        ),
      );
    }

    if (!response.ok) {
      return err(
        new GenericError(
          `Unexpected response from lollipop healthcheck endpoint: ${response.status}`,
        ),
      );
    }

    return ok(undefined);
  },

  reservePubKey: async ({ algorithm, publicKey }) => {
    let response: Response;

    try {
      response = await fetch(
        `${config.LOLLIPOP_API_URL}${config.LOLLIPOP_API_BASE_PATH}/pubkeys`,
        {
          body: JSON.stringify({
            algo: algorithm,
            pub_key: decodeJwk(publicKey),
          }),
          headers: {
            "Content-Type": "application/json",
            "X-Functions-Key": config.LOLLIPOP_API_KEY,
          },
          method: "POST",
        },
      );
    } catch (e) {
      return err(
        new GenericError(
          `Failed to reach lollipop reserve endpoint: ${e instanceof Error ? e.message : String(e)}`,
        ),
      );
    }

    if (response.status === 409) {
      return err(new ConflictError("PubKey is already reserved"));
    }

    if (!response.ok) {
      return err(
        new GenericError(
          `Unexpected response from lollipop reserve endpoint: ${response.status}`,
        ),
      );
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      return err(
        new GenericError(
          "Failed to parse response body from lollipop reserve endpoint",
        ),
      );
    }

    const parsed = LollipopPublicKeySchema.safeParse(body);
    if (!parsed.success) {
      return err(
        new GenericError("Invalid response from lollipop reserve endpoint"),
      );
    }

    return ok(parsed.data);
  },
});
