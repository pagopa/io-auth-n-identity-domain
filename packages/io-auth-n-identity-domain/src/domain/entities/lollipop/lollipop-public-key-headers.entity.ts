import { z } from "zod";

import {
  LollipopPublicKeyHashingAlgorithmSchema,
  LollipopPublicKeySchema,
} from "../../value-objects/index.js";

/**
 * Lollipop public key headers.
 * The public key is always required; the hashing algorithm is optional.
 */
export const LollipopPublicKeyHeadersSchema = z.object({
  /** Base64url-encoded JWK public key */
  "x-pagopa-lollipop-pub-key": LollipopPublicKeySchema,

  /** Thumbprint hashing algorithm — defaults to sha256 when absent */
  "x-pagopa-lollipop-pub-key-hash-algo":
    LollipopPublicKeyHashingAlgorithmSchema.optional(),
});

export type LollipopPublicKeyHeaders = z.infer<
  typeof LollipopPublicKeyHeadersSchema
>;
