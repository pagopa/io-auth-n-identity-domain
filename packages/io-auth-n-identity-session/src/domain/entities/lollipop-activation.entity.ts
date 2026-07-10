import { FiscalCodeSchema } from "@pagopa/hexagonal-core";
import { LollipopAssertionRefSchema } from "@pagopa/io-auth-n-identity-domain";
import { z } from "zod";

import { LoginType, LoginTypeSchema } from "../value-objects/login-type.vo.js";

/**
 * Schema for a LollipopActivation
 */
export const LollipopActivationSchema = z.object({
  fiscalCode: FiscalCodeSchema,
  assertionRef: LollipopAssertionRefSchema,
  expirationDate: z.date(),
});

export type LollipopActivation = z.infer<typeof LollipopActivationSchema>;

// ------------------------------------------------------------------------------
// Helper functions
// ------------------------------------------------------------------------------

const getLollipopActivationTtlMsByLoginType = (loginType: LoginType) => {
  const ttlByLoginType = {
    LV: 365 * 24 * 60 * 60 * 1_000, // 1 year
    LEGACY: 30 * 24 * 60 * 60 * 1_000, // 30 days
  } as const;

  return ttlByLoginType[loginType];
};
