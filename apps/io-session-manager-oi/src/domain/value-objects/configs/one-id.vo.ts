import { NonEmptyStringSchema } from "@pagopa/hexagonal-core";
import { z } from "zod";

import { HttpUrlCodec } from "../../../utils/codec/url.js";

export const OneIdConfigSchema = z.object({
  ONEID_PROD_CLIENT_ID: NonEmptyStringSchema,
  ONEID_PROD_CLIENT_SECRET: NonEmptyStringSchema,
  ONEID_PROD_ISSUER: HttpUrlCodec,
  ONEID_PROD_REDIRECT_URI: HttpUrlCodec,

  ONEID_UAT_CLIENT_ID: NonEmptyStringSchema.optional(),
  ONEID_UAT_CLIENT_SECRET: NonEmptyStringSchema.optional(),
  ONEID_UAT_ISSUER: HttpUrlCodec.optional(),
});

export type OneIdConfig = z.infer<typeof OneIdConfigSchema>;
