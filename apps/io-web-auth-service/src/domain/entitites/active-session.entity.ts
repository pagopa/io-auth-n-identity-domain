import { FiscalCodeSchema, NonEmptyStringSchema } from "@pagopa/hexagonal-core";
import z from "zod";

import { SpidLevelSchema } from "../value-objects/login.vo.js";
import { PositiveIntegerSchema } from "../value-objects/positive-integer.vo.js";

export const ActiveSessionSchema = z.object({
  name: NonEmptyStringSchema,
  family_name: NonEmptyStringSchema,
  fiscal_number: FiscalCodeSchema,
  spid_level: SpidLevelSchema,
});
export type ActiveSession = z.infer<typeof ActiveSessionSchema>;

export const ActiveSessionMetadataSchema = z.object({
  id: NonEmptyStringSchema,
  expiresAtSeconds: PositiveIntegerSchema,
});
export type ActiveSessionMetadata = z.infer<typeof ActiveSessionMetadataSchema>;

export const VerifiedActiveSessionSchema = z.object({
  metadata: ActiveSessionMetadataSchema,
  user: ActiveSessionSchema,
});
export type VerifiedActiveSession = z.infer<typeof VerifiedActiveSessionSchema>;
