import { FiscalCodeSchema } from "@pagopa/hexagonal-core";
import {
  LollipopAssertionRefSchema,
  LollipopAssertionTypeSchema,
  LollipopJwtAuthorizationSchema,
  LollipopMethodSchema,
  LollipopOriginalUrlSchema,
  LollipopSignatureInputSchema,
  LollipopSignatureSchema,
  IPStringSchema,
  LollipopJwkSchema,
} from "@pagopa/io-auth-n-identity-domain";
import { z } from "zod";

export const FastLoginParamsSchema = z.object({
  originalMethod: LollipopMethodSchema,
  originalUrl: LollipopOriginalUrlSchema,
  authJWT: LollipopJwtAuthorizationSchema,
  assertionRef: LollipopAssertionRefSchema,
  assertionType: LollipopAssertionTypeSchema,
  userId: FiscalCodeSchema,
  signature: LollipopSignatureSchema,
  signatureInput: LollipopSignatureInputSchema,
  clientIp: IPStringSchema,
  publicKey: LollipopJwkSchema,
});
export type FastLoginParams = z.infer<typeof FastLoginParamsSchema>;
