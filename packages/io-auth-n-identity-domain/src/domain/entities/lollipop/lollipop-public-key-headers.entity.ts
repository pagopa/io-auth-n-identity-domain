import { z } from "zod";

import {
  LollipopPublicKeyHashingAlgorithmSchema,
  LollipopPublicKeySchema,
} from "../../value-objects/index.js";

/**
 * Lollipop public key headers.
 */
export const LollipopPublicKeyHeadersSchema = z.object({
  /** Base64url-encoded JWK public key */
  "x-pagopa-lollipop-pub-key": LollipopPublicKeySchema,

  /** Thumbprint hashing algorithm */
  "x-pagopa-lollipop-pub-key-hash-algo":
    LollipopPublicKeyHashingAlgorithmSchema.optional(),
});

export type LollipopPublicKeyHeaders = z.infer<
  typeof LollipopPublicKeyHeadersSchema
>;
