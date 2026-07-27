import { FiscalCodeSchema } from "@pagopa/hexagonal-core";
import { z } from "zod";

import { LoginType, LoginTypeSchema } from "../value-objects/login-type.vo.js";
import { SessionIdSchema } from "../value-objects/session-id.vo.js";

/**
 * It represents the data of an active session, which is used to understand if the user is logged in or not.
 * It also contains information about the login type and the expiration date of the user session.
 */
export const ActiveSessionSchema = z.object({
  fiscalCode: FiscalCodeSchema,
  loginType: LoginTypeSchema,
  sessionId: SessionIdSchema,
  expirationDate: z.date(),
});

export type ActiveSession = z.infer<typeof ActiveSessionSchema>;

// ------------------------------------------------------------------------------
// Helper functions
// ------------------------------------------------------------------------------

export const newActiveSession = ({
  fiscalCode,
  loginType,
  sessionId,
}: Omit<ActiveSession, "expirationDate">): ActiveSession => ({
  fiscalCode,
  loginType,
  sessionId,
  expirationDate: new Date(
    Date.now() + getActiveSessionTtlMsByLoginType(loginType),
  ),
});

const getActiveSessionTtlMsByLoginType = (loginType: LoginType) => {
  const ttlByLoginType = {
    LV: 365 * 24 * 60 * 60 * 1_000, // 1 year
    LEGACY: 30 * 24 * 60 * 60 * 1_000, // 30 days
  } as const;

  return ttlByLoginType[loginType];
};
