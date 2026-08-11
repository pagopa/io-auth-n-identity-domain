import { FiscalCodeSchema, NonEmptyStringSchema } from "@pagopa/hexagonal-core";
import {
  IPStringSchema,
  TimestampMillisToDate,
} from "@pagopa/io-auth-n-identity-domain";
import { z } from "zod";

const BaseRejectedLoginSchema = z.object({
  eventType: z.literal("rejected_login"),
  fiscalCode: FiscalCodeSchema,
  ts: TimestampMillisToDate,
  expiredAt: TimestampMillisToDate,
  ip: IPStringSchema,
  loginId: NonEmptyStringSchema.optional(),
});

const AgeBlockRejectedLoginSchema = BaseRejectedLoginSchema.extend({
  rejectionCause: z.literal("age_block"),
  minimumAge: z.number(),
  dateOfBirth: z.string(),
});

const AuthLockRejectedLoginSchema = BaseRejectedLoginSchema.extend({
  rejectionCause: z.literal("auth_lock"),
});

const UserMismatchRejectedLoginSchema = BaseRejectedLoginSchema.extend({
  rejectionCause: z.literal("cf_mismatch"),
  currentFiscalCodeHash: z.string().regex(/^[a-fA-F0-9]{64}$/),
});

const OngoingUserDeletionRejectedLoginSchema = BaseRejectedLoginSchema.extend({
  rejectionCause: z.literal("ongoing_user_deletion"),
});

export const RejectedLoginEventSchema = z.discriminatedUnion("rejectionCause", [
  AgeBlockRejectedLoginSchema,
  AuthLockRejectedLoginSchema,
  UserMismatchRejectedLoginSchema,
  OngoingUserDeletionRejectedLoginSchema,
]);
export type RejectedLoginEvent = z.infer<typeof RejectedLoginEventSchema>;
