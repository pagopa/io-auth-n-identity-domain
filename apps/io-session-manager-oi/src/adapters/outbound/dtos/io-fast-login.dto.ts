import { FiscalCodeSchema, NonEmptyStringSchema } from "@pagopa/hexagonal-core";
import {
  IPStringSchema,
  LollipopAssertionRefSchema,
  LollipopAssertionTypeSchema,
  LollipopJwkSchema,
  LollipopJwtAuthorizationSchema,
  LollipopMethodSchema,
  LollipopOriginalUrlSchema,
  LollipopSignatureInputSchema,
  LollipopSignatureSchema,
} from "@pagopa/io-auth-n-identity-domain";
import { z } from "zod";

export const FastLoginPayloadDTO = z.object({
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
export type FastLoginPayloadDTO = z.infer<typeof FastLoginPayloadDTO>;

export const FastLoginResponseDTO = z.object({
  saml_response: NonEmptyStringSchema,
});
export type FastLoginResponseDTO = z.infer<typeof FastLoginResponseDTO>;
