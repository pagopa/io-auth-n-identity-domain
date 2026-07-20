import { FiscalCodeSchema, NonEmptyStringSchema } from "@pagopa/hexagonal-core";
import {
  JwkPublicKeySchema,
  LollipopAssertionRefSchema,
  LollipopJwkHashingAlgorithmSchema,
  LollipopJwkSchema,
  PubKeyStatusSchema,
  TimestampSchema,
  AssertionTypeSchema,
} from "@pagopa/io-auth-n-identity-domain";
import { z } from "zod";

export const NewPubKeyPayloadDto = z.object({
  algo: LollipopJwkHashingAlgorithmSchema,
  pub_key: JwkPublicKeySchema,
});
export type NewPubKeyPayloadDto = z.infer<typeof NewPubKeyPayloadDto>;

export const NewPubKeyDto = z.object({
  assertion_ref: LollipopAssertionRefSchema,
  pub_key: LollipopJwkSchema,
  version: z.number().int().min(0),
  status: PubKeyStatusSchema,
  ttl: z.number().int().min(0),
});
export type NewPubKeyDto = z.infer<typeof NewPubKeyDto>;

export const ActivatePubKeyPayloadDto = z.object({
  fiscal_code: FiscalCodeSchema,
  assertion_type: AssertionTypeSchema,
  assertion: NonEmptyStringSchema,
  expired_at: TimestampSchema,
});
export type ActivatePubKeyPayloadDto = z.infer<
  typeof ActivatePubKeyPayloadDto
>;

export const ActivatedPubKeyDto = NewPubKeyDto.extend({
  fiscal_code: FiscalCodeSchema,
  assertion_file_name: NonEmptyStringSchema,
  assertion_type: AssertionTypeSchema,
  // ISO 8601 formatted date
  expired_at: NonEmptyStringSchema,
});
export type ActivatedPubKeyDto = z.infer<typeof ActivatedPubKeyDto>;

export const GenerateLcParamsPayloadDto = z.object({
  operation_id: NonEmptyStringSchema,
});
export type GenerateLcParamsPayloadDto = z.infer<
  typeof GenerateLcParamsPayloadDto
>;

export const LcParamsDto = ActivatedPubKeyDto.extend({
  lc_authentication_bearer: NonEmptyStringSchema,
});
export type LcParamsDto = z.infer<typeof LcParamsDto>;
