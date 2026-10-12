import { FiscalCodeSchema } from "@pagopa/hexagonal-core";
import { TimestampMillisToDate } from "@pagopa/io-auth-n-identity-domain";
import { z } from "zod";

export const LogoutEventSchema = z.object({
  eventType: z.literal("logout"),
  fiscalCode: FiscalCodeSchema,
  ts: TimestampMillisToDate,
  scenario: z.enum(["app", "web", "auth_lock", "account_removal"]),
});
export type LogoutEvent = z.infer<typeof LogoutEventSchema>;
