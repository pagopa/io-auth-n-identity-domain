import { FiscalCodeSchema } from "@pagopa/hexagonal-core";
import { DateToTimestamp } from "@pagopa/io-auth-n-identity-domain";
import { z } from "zod";

export const LoginEventSchema = z.object({
  eventType: z.literal("login"),
  fiscalCode: FiscalCodeSchema,
  ts: DateToTimestamp,
  expiredAt: DateToTimestamp,
  loginType: z.enum(["legacy", "lv"]),
  scenario: z.enum(["new_user", "standard", "relogin"]),
  idp: z.string(),
});
export type LoginEvent = z.infer<typeof LoginEventSchema>;
