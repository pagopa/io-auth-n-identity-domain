import { z } from "zod";

import {
  LollipopAssertionRefSchema,
  LollipopPublicKeySchema,
} from "../../value-objects/index.js";

export const LollipopNewPublicKeySchema = z.object({
  assertion_ref: LollipopAssertionRefSchema,
  pub_key: LollipopPublicKeySchema,
  version: z.number().int().nonnegative(),
  status: z.enum(["PENDING", "VALID", "REVOKED"]),
  ttl: z.number().int().nonnegative(),
});

export type LollipopNewPublicKey = z.infer<typeof LollipopNewPublicKeySchema>;
