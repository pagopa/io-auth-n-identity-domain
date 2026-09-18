import { z } from "zod";

import { CidrV4ReadonlyArray } from "../cidr-v4-readonly-array.vo.js";

/**
 * Comma-separated list of IPv4 CIDR blocks allowed to reach Wallet endpoints.
 */
export const WalletConfigSchema = z.object({
  ALLOW_WALLET_IP_SOURCE_RANGE: CidrV4ReadonlyArray,
});

export type WalletConfig = z.infer<typeof WalletConfigSchema>;
