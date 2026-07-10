import { FiscalCodeSchema } from "@pagopa/hexagonal-core";
import { z } from "zod";

import { LoginType, LoginTypeSchema } from "../value-objects/login-type.vo.js";
import { SessionTrackingIdSchema } from "../value-objects/session-tracking-id.vo.js";

/**
 * It represents the metadata of a session, which is used to understand if the user is logged in or not.
 * It also contains information about the login type and the expiration date of the user session.
 */
export const SessionMetadataSchema = z.object({
  fiscalCode: FiscalCodeSchema,
  loginType: LoginTypeSchema,
  sessionTrackingId: SessionTrackingIdSchema,
  expirationDate: z.date(),
});

export type SessionMetadata = z.infer<typeof SessionMetadataSchema>;

// ------------------------------------------------------------------------------
// Helper functions
// ------------------------------------------------------------------------------

export const newSessionMetadata = ({
  fiscalCode,
  loginType,
  sessionTrackingId,
}: Omit<SessionMetadata, "expirationDate">): SessionMetadata => ({
  fiscalCode,
  loginType,
  sessionTrackingId,
  expirationDate: new Date(
    Date.now() + getSessionMetadataTtlMsByLoginType(loginType),
  ),
});

const getSessionMetadataTtlMsByLoginType = (loginType: LoginType) => {
  const ttlByLoginType = {
    LV: 365 * 24 * 60 * 60 * 1_000, // 1 year
    LEGACY: 30 * 24 * 60 * 60 * 1_000, // 30 days
  } as const;

  return ttlByLoginType[loginType];
};
