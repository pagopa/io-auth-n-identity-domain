import { NonEmptyStringSchema } from "@pagopa/hexagonal-core";
import { z } from "zod";

export const OneIdConfigSchema = z.object({
  ONEID_PROD_CLIENT_ID: NonEmptyStringSchema,
  ONEID_PROD_CLIENT_SECRET: NonEmptyStringSchema,
  ONEID_PROD_ISSUER: NonEmptyStringSchema,
  ONEID_PROD_REDIRECT_URI: NonEmptyStringSchema,

  ONEID_UAT_CLIENT_ID: NonEmptyStringSchema.optional(),
  ONEID_UAT_CLIENT_SECRET: NonEmptyStringSchema.optional(),
  ONEID_UAT_ISSUER: NonEmptyStringSchema.optional(),
});
