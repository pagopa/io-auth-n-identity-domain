import { FiscalCodeSchema } from "@pagopa/hexagonal-core";
import { DateToTimestamp } from "@pagopa/io-auth-n-identity-domain";
import { z } from "zod";

export const LogoutEventSchema = z.object({
  eventType: z.literal("logout"),
  fiscalCode: FiscalCodeSchema,
  ts: DateToTimestamp,
  scenario: z.enum(["app", "web", "auth_lock", "account_removal"]),
});
export type LogoutEvent = z.infer<typeof LogoutEventSchema>;
