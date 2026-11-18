import { NonEmptyStringSchema } from "@pagopa/hexagonal-core";
import { z } from "zod";

import { HttpUrlCodec } from "../../../utils/codec/url.js";

export const OneIdConfigSchema = z.object({
  ONEID_PROD_CLIENT_ID: NonEmptyStringSchema,
  ONEID_PROD_CLIENT_SECRET: NonEmptyStringSchema,
  ONEID_PROD_ISSUER: HttpUrlCodec,
  // Callback URL registered on OneIdentity, shared by the PROD and UAT clients.
  ONEID_PROD_REDIRECT_URI: HttpUrlCodec,

  ONEID_UAT_CLIENT_ID: NonEmptyStringSchema.optional(),
  ONEID_UAT_CLIENT_SECRET: NonEmptyStringSchema.optional(),
  ONEID_UAT_ISSUER: HttpUrlCodec.optional(),

  // Timeout (seconds) applied to every HTTP request towards the OIDC provider
  // (discovery, JWKS, token endpoint). Prevents slow upstream responses from
  // exhausting connections under load.
  ONEID_HTTP_TIMEOUT_SECONDS: z.coerce.number().int().positive().default(8),
});

export type OneIdConfig = z.infer<typeof OneIdConfigSchema>;
