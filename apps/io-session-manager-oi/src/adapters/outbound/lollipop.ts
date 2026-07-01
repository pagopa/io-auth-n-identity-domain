import {
  ConflictError,
  GenericError,
} from "@pagopa/hexagonal-core/domain/errors";
import { LollipopJwk } from "@pagopa/io-auth-n-identity-domain";
import { err, ok } from "neverthrow";

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
    const url = `${config.LOLLIPOP_API_URL}/info`;
    try {
      response = await fetch(url);
    } catch (e) {
      return err(
        new GenericError(
          `Failed to reach lollipop healthcheck endpoint '${url}': ${e instanceof Error ? e.message : String(e)}`,
        ),
      );
    }

    if (!response.ok) {
      return err(
        new GenericError(
          `Unexpected response from lollipop healthcheck endpoint '${url}': ${response.status}`,
        ),
      );
    }

    return ok(undefined);
  },

  reservePubKey: async ({ algorithm, publicKey }) => {
    let response: Response;
    const url = `${config.LOLLIPOP_API_URL}${config.LOLLIPOP_API_BASE_PATH}/pubkeys`;

    try {
      response = await fetch(url, {
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
          `Failed to reach lollipop reserve endpoint '${url}': ${e instanceof Error ? e.message : String(e)}`,
        ),
      );
    }

    if (response.status === 409) {
      return err(new ConflictError("PubKey is already reserved"));
    }

    if (!response.ok) {
      return err(
        new GenericError(
          `Unexpected response from lollipop reserve endpoint '${url}': Status ${response.status}: ${await response.text()}`,
        ),
      );
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      return err(
        new GenericError(
          `Failed to parse response body from lollipop reserve endpoint`,
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
