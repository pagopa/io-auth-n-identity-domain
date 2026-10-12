import { z } from "zod";

import { CidrV4ReadonlyArray } from "../cidr-v4-readonly-array.vo.js";

/**
 * Comma-separated list of IPv4 CIDR blocks allowed to reach PagoPA endpoints.
 */
export const PagopaConfigSchema = z.object({
  ALLOW_PAGOPA_IP_SOURCE_RANGE: CidrV4ReadonlyArray,
});

export type PagopaConfig = z.infer<typeof PagopaConfigSchema>;
