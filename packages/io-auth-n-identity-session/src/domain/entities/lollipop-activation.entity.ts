import { FiscalCodeSchema } from "@pagopa/hexagonal-core";
import { LollipopAssertionRefSchema } from "@pagopa/io-auth-n-identity-domain";
import { z } from "zod";

import { LoginType } from "../value-objects/login-type.vo.js";

/**
 * Schema for a LollipopActivation
 */
export const LollipopActivationSchema = z.object({
  fiscalCode: FiscalCodeSchema,
  assertionRef: LollipopAssertionRefSchema,
  expirationDate: z.date(),
});

export type LollipopActivation = z.infer<typeof LollipopActivationSchema>;
