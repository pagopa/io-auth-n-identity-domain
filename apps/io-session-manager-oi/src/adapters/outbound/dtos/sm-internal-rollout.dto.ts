import { LollipopAssertionRefSchema } from "@pagopa/io-auth-n-identity-domain";
import { z } from "zod";

export const LollipopActivationDto = z.object({
  assertion_ref: LollipopAssertionRefSchema,
});
export type LollipopActivationDto = z.infer<typeof LollipopActivationDto>;
