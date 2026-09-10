import { z } from "zod";

const CidrV4ReadonlyArray = z
  .string()
  .transform((raw) =>
    raw
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0),
  )
  .pipe(z.array(z.cidrv4()))
  .readonly();

/**
 * Comma-separated list of IPv4 CIDR blocks allowed to reach BPD endpoints.
 */
export const BPDConfigSchema = z.object({
  ALLOW_BPD_IP_SOURCE_RANGE: CidrV4ReadonlyArray,
});

export type BPDConfig = z.infer<typeof BPDConfigSchema>;
