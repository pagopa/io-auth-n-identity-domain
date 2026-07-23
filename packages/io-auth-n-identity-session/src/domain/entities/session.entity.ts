import {
  EmailAddressSchema,
  FiscalCodeSchema,
  NonEmptyStringSchema,
} from "@pagopa/hexagonal-core";
import { z } from "zod";

import { LoginType } from "../value-objects/login-type.vo.js";
import { SessionTrackingId } from "../value-objects/session-tracking-id.vo.js";
import { SpidLevelSchema } from "../value-objects/spid-level.vo.js";
import {
  toHashedBpdSSOToken,
  toPlainBpdSSOToken,
} from "../value-objects/tokens/bpd-sso-token.vo.js";
import {
  toHashedFimsSSOToken,
  toPlainFimsSSOToken,
} from "../value-objects/tokens/fims-sso-token.vo.js";
import {
  HashedSessionTokenWithTrackingIdSchema,
  newPlainSessionToken,
  PlainSessionTokenWithTrackingIdSchema,
  toHashedSessionToken,
} from "../value-objects/tokens/session-token.vo.js";
import {
  HashedSSOTokensSchema,
  PlainSSOTokensSchema,
} from "../value-objects/tokens/sso-token.vo.js";
import {
  toHashedWalletSSOToken,
  toPlainWalletSSOToken,
} from "../value-objects/tokens/wallet-sso-token.vo.js";
import {
  toHashedZendeskSSOToken,
  toPlainZendeskSSOToken,
} from "../value-objects/tokens/zendesk-sso-token.vo.js";

const BaseSessionSchema = z.object({
  fiscalCode: FiscalCodeSchema,
  name: NonEmptyStringSchema,
  familyName: NonEmptyStringSchema,
  dateOfBirth: z.date(),
  spidLevel: SpidLevelSchema,
  spidEmail: EmailAddressSchema.optional(),
  expirationDate: z.date(),
});

// ------------------------------------------------------------------------------
// Plain Session Token Value Object
// ------------------------------------------------------------------------------

/**
 * An extension of the BaseSessionSchema that includes a plain session token with tracking ID,
 * representing a unique identifier for the user session.
 */
export const PlainSessionSchema = BaseSessionSchema.extend({
  plainSessionTokenWithTrackingId: PlainSessionTokenWithTrackingIdSchema,
});

/**
 * A session with a plain session token with tracking ID, representing a unique identifier for the user session.
 */
export type PlainSession = z.infer<typeof PlainSessionSchema>;

/**
 * An extension of the SessionSchema that includes plain SSO tokens,
 * representing a session with associated SSO tokens in plain text.
 */
export const SessionWithPlainSSOTokensSchema = PlainSessionSchema.extend({
  ssoTokens: PlainSSOTokensSchema,
});

/**
 * A session with associated SSO tokens that have already been hashed to be stored.
 */
export type SessionWithPlainSSOTokens = z.infer<
  typeof SessionWithPlainSSOTokensSchema
>;

// --------------------------------------
// Helper functions
// --------------------------------------

export const getSessionTtlMsByLoginType = (loginType: LoginType) => {
  const ttlByLoginType = {
    LV: 15 * 60 * 1_000, // 15 minutes (short-lived token, renewable)
    LEGACY: 30 * 24 * 60 * 60 * 1_000, // 30 days
  } as const;

  return ttlByLoginType[loginType];
};

export const newPlainSession = async ({
  sessionTrackingId,
  loginType,
  ...baseData
}: Omit<z.infer<typeof BaseSessionSchema>, "expirationDate"> & {
  sessionTrackingId: SessionTrackingId;
  loginType: LoginType;
}): Promise<SessionWithPlainSSOTokens> => {
  const plainSessionToken = await newPlainSessionToken();
  return {
    ...baseData,
    expirationDate: new Date(
      Date.now() + getSessionTtlMsByLoginType(loginType),
    ),
    plainSessionTokenWithTrackingId: {
      sessionTrackingId,
      plainSessionToken,
    },
    ssoTokens: {
      walletPlainToken: toPlainWalletSSOToken(plainSessionToken),
      bpdPlainToken: toPlainBpdSSOToken(plainSessionToken),
      fimsPlainToken: toPlainFimsSSOToken(plainSessionToken),
      zendeskPlainToken: toPlainZendeskSSOToken(plainSessionToken),
    },
  };
};

// ------------------------------------------------------------------------------
// Hashed Session Token Value Object
// ------------------------------------------------------------------------------

/**
 * An extension of the BaseSessionSchema that includes a hashed session token with tracking ID,
 * representing a unique identifier for the user session.
 * It is used to store the session in a secure way, without exposing the plain session token.
 */
export const SessionSchema = BaseSessionSchema.extend({
  hashedSessionTokenWithTrackingId: HashedSessionTokenWithTrackingIdSchema,
});

/**
 * A session with a hashed session token with tracking ID, representing a unique identifier for the user session.
 * It is used to store the session in a secure way, without exposing the plain session token.
 */
export type Session = z.infer<typeof SessionSchema>;

/**
 * An extension of the SessionSchema that includes hashed SSO tokens,
 * representing a session with associated SSO tokens that have already been hashed to be stored.
 */
export const SessionWithHashedSSOTokensSchema = SessionSchema.extend({
  ssoTokens: HashedSSOTokensSchema,
});

/**
 * A session with associated SSO tokens that have already been hashed to be stored.
 */
export type SessionWithHashedSSOTokens = z.infer<
  typeof SessionWithHashedSSOTokensSchema
>;

// --------------------------------------
// Helper functions
// --------------------------------------

export const toHashedSession = (
  sessionWithPlainSSOTokens: SessionWithPlainSSOTokens,
): SessionWithHashedSSOTokens => {
  const { plainSessionTokenWithTrackingId, ssoTokens, ...baseData } =
    sessionWithPlainSSOTokens;

  return {
    ...baseData,
    hashedSessionTokenWithTrackingId: {
      sessionTrackingId: plainSessionTokenWithTrackingId.sessionTrackingId,
      hashedSessionToken: toHashedSessionToken(
        plainSessionTokenWithTrackingId.plainSessionToken,
      ),
    },
    ssoTokens: {
      walletHashedToken: toHashedWalletSSOToken(ssoTokens.walletPlainToken),
      bpdHashedToken: toHashedBpdSSOToken(ssoTokens.bpdPlainToken),
      fimsHashedToken: toHashedFimsSSOToken(ssoTokens.fimsPlainToken),
      zendeskHashedToken: toHashedZendeskSSOToken(ssoTokens.zendeskPlainToken),
    },
  };
};
