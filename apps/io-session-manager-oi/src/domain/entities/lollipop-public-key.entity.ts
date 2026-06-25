import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import {
  LollipopAssertionRefSchema,
  LollipopJwkSchema,
} from "@pagopa/io-auth-n-identity-domain";
import { z } from "zod";

extendZodWithOpenApi(z);

export const LollipopPublicKeySchema = z.object({
  assertion_ref: LollipopAssertionRefSchema,
  pub_key: LollipopJwkSchema,
  version: z.number().int().nonnegative(),
  status: z.enum(["PENDING", "VALID", "REVOKED"]),
  ttl: z.number().int().nonnegative(),
});

export type LollipopPublicKey = z.infer<typeof LollipopPublicKeySchema>;
