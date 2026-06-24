import { z } from "zod";

import {
  LollipopMethodSchema,
  LollipopOriginalUrlSchema,
  LollipopContentDigestSchema,
  LollipopContentTypeSchema,
  LollipopSignatureInputSchema,
  LollipopSignatureSchema,
} from "../../value-objects/index.js";

/**
 * Required Lollipop headers that must be present on every signed request.
 * Patterns are derived from the Lollipop protocol specification.
 */
export const LollipopRequiredHeadersSchema = z.object({
  /** HTTP message signature, e.g. `sig1=:BASE64:` */
  signature: LollipopSignatureSchema,

  /** HTTP message signature-input, e.g. `sig1=("@method");nonce="..."` */
  "signature-input": LollipopSignatureInputSchema,

  /** Original HTTP method of the signed request */
  "x-pagopa-lollipop-original-method": LollipopMethodSchema,

  /** Original URL of the signed request — must use HTTPS */
  "x-pagopa-lollipop-original-url": LollipopOriginalUrlSchema,

  /**
   * SHA digest of the request body (optional; required only when a body is present).
   * Format: `sha-256=:BASE64:` / `sha-384=:BASE64:` / `sha-512=:BASE64:`
   */
  "content-digest": LollipopContentDigestSchema.optional(),

  /** Content type of the request body (optional; required only when a body is present) */
  "content-type": LollipopContentTypeSchema.optional(),
});

export type LollipopRequiredHeaders = z.infer<
  typeof LollipopRequiredHeadersSchema
>;
