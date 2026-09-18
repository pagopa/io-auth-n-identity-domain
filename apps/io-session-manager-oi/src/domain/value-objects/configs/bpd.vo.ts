import { z } from "zod";

import { CidrV4ReadonlyArray } from "../cidr-v4-readonly-array.vo.js";

/**
 * Comma-separated list of IPv4 CIDR blocks allowed to reach BPD endpoints.
 */
export const BPDConfigSchema = z.object({
  ALLOW_BPD_IP_SOURCE_RANGE: CidrV4ReadonlyArray,
});

export type BPDConfig = z.infer<typeof BPDConfigSchema>;
