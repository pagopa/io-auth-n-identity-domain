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
  createdAt: z.date(),
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
}: Omit<ActiveSession, "expirationDate" | "createdAt">): ActiveSession => {
  const createdAt = new Date();
  return {
    fiscalCode,
    loginType,
    sessionId,
    createdAt: createdAt,
    expirationDate: getActiveSessionExpiration(loginType, createdAt),
  };
};

const getActiveSessionTtlMsByLoginType = (loginType: LoginType) => {
  const ttlByLoginType = {
    LV: 365 * 24 * 60 * 60 * 1_000, // 1 year
    LEGACY: 30 * 24 * 60 * 60 * 1_000, // 30 days
  } as const;

  return ttlByLoginType[loginType];
};

/**
 * Returns the expiration date of an active session based on the login type and the starting date.
 *
 * @param loginType The type of login used for the session.
 * @param from The starting date from which to calculate the expiration date. Defaults to the current date and time.
 * @returns The calculated expiration date of the active session.
 */
export const getActiveSessionExpiration = (
  loginType: LoginType,
  from: Date = new Date(),
) => new Date(from.getTime() + getActiveSessionTtlMsByLoginType(loginType));
