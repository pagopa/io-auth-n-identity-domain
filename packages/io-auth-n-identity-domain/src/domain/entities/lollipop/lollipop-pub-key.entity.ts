import { FiscalCodeSchema, NonEmptyStringSchema } from "@pagopa/hexagonal-core";
import { z } from "zod";

import { TimestampSchema } from "../../value-objects/common/timestamp.value-object.js";
import { LollipopAssertionRefSchema } from "../../value-objects/lollipop/lollipop-assertion-ref.value-object.js";
import { AssertionTypeSchema } from "../../value-objects/lollipop/lollipop-assertion-type.value-object.js";
import { LollipopJwkHashingAlgorithmSchema } from "../../value-objects/lollipop/lollipop-jwk-hash-algorithm.value-object.js";
import { LollipopJwkSchema } from "../../value-objects/lollipop/lollipop-jwk.value-object.js";
import { PubKeyStatusSchema } from "../../value-objects/lollipop/lollipop-pub-key-status.value-object.js";

import { JwkPublicKeySchema } from "./lollipop-jwk-public-key.entity.js";

export const NewPubKeyPayloadSchema = z.object({
  algo: LollipopJwkHashingAlgorithmSchema,
  pub_key: JwkPublicKeySchema,
});
export type NewPubKeyPayloadSchema = z.infer<typeof NewPubKeyPayloadSchema>;

export const NewPubKeySchema = z.object({
  assertion_ref: LollipopAssertionRefSchema,
  pub_key: LollipopJwkSchema,
  version: z.number().int().min(0),
  status: PubKeyStatusSchema,
  ttl: z.number().int().min(0),
});
export type NewPubKeySchema = z.infer<typeof NewPubKeySchema>;

export const ActivatePubKeyPayloadSchema = z.object({
  fiscal_code: FiscalCodeSchema,
  assertion_type: AssertionTypeSchema,
  assertion: NonEmptyStringSchema,
  expired_at: TimestampSchema,
});
export type ActivatePubKeyPayloadSchema = z.infer<
  typeof ActivatePubKeyPayloadSchema
>;

export const ActivatedPubKeySchema = NewPubKeySchema.extend({
  fiscal_code: FiscalCodeSchema,
  assertion_file_name: NonEmptyStringSchema,
  assertion_type: AssertionTypeSchema,
  // ISO 8601 formatted date
  expired_at: NonEmptyStringSchema,
});
export type ActivatedPubKeySchema = z.infer<typeof ActivatedPubKeySchema>;

export const GenerateLcParamsPayloadSchema = z.object({
  operation_id: NonEmptyStringSchema,
});
export type GenerateLcParamsPayloadSchema = z.infer<
  typeof GenerateLcParamsPayloadSchema
>;

export const LcParamsSchema = ActivatedPubKeySchema.extend({
  lc_authentication_bearer: NonEmptyStringSchema,
});
export type LcParamsSchema = z.infer<typeof LcParamsSchema>;
