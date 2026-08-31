import { CidrListSchema } from "@pagopa/io-auth-n-identity-domain";
import { z } from "zod";

/**
 * Comma-separated list of IPs or CIDRs allowed to reach BPD endpoints.
 */
export const BPDConfigSchema = z.object({
  ALLOW_BPD_IP_SOURCE_RANGE: CidrListSchema,
});

export type BPDConfig = z.infer<typeof BPDConfigSchema>;
