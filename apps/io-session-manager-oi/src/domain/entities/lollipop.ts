import { z } from "zod";

import { FiscalCodeSchema } from "@pagopa/io-core-domain";

/**
 * Required lollipop headers that must be present on every signed request.
 * Patterns are derived from the lollipop protocol specification.
 */
export const LollipopRequiredHeadersSchema = z.object({
  /** HTTP message signature, e.g. `sig1=:BASE64:` */
  signature: z.string().regex(/^((sig[0-9]+)=:[A-Za-z0-9+/=]*:(, ?)?)+$/),

  /** HTTP message signature-input, e.g. `sig1=("@method");nonce="..."` */
  "signature-input": z
    .string()
    .regex(/^(?:sig\d+=[^,]*)(?:,\s*(?:sig\d+=[^,]*))*$/),

  /** Original HTTP method of the signed request */
  "x-pagopa-lollipop-original-method": z.enum([
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
  ]),

  /** Original URL of the signed request — must use HTTPS */
  "x-pagopa-lollipop-original-url": z.string().startsWith("https://"),

  /**
   * SHA digest of the request body (optional; required only when a body is present).
   * Format: `sha-256=:BASE64:` / `sha-384=:BASE64:` / `sha-512=:BASE64:`
   */
  "content-digest": z
    .string()
    .regex(
      /^(sha-256=:[A-Za-z0-9+/=]{44}:|sha-384=:[A-Za-z0-9+/=]{64}:|sha-512=:[A-Za-z0-9+/=]{88}:)$/,
    )
    .optional(),
});

export type LollipopRequiredHeaders = z.infer<
  typeof LollipopRequiredHeadersSchema
>;

/**
 * LC (Lollipop Consumer) params returned by the lollipop function API.
 * Field names mirror the API response payload from `generateLCParams`.
 */
export const LcParamsSchema = z.object({
  /** Assertion reference, e.g. `sha256-<thumbprint>` */
  assertion_ref: z.string().min(1),

  /** Assertion type, e.g. "SAML" or "OIDC" */
  assertion_type: z.string().min(1),

  /** Bearer token for the lollipop consumer (x-pagopa-lollipop-auth-jwt) */
  lc_authentication_bearer: z.string().min(1),

  /** Base64url-encoded public key JWK (x-pagopa-lollipop-public-key) */
  pub_key: z.string().min(1),

  /** Fiscal code of the authenticated user */
  fiscal_code: FiscalCodeSchema,
});

export type LcParams = z.infer<typeof LcParamsSchema>;

/**
 * Full lollipop context stored on the Fastify request after the hook runs.
 * Downstream handlers read this to forward lollipop headers to internal APIs.
 */
export const LollipopContextSchema = z.object({
  /** Validated lollipop request headers */
  requestHeaders: LollipopRequiredHeadersSchema,
  /** LC params obtained from the lollipop service */
  lcParams: LcParamsSchema,
});

export type LollipopContext = z.infer<typeof LollipopContextSchema>;
