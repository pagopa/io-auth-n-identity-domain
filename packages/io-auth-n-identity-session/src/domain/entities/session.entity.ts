import {
  EmailAddressSchema,
  FiscalCodeSchema,
  NonEmptyStringSchema,
} from "@pagopa/hexagonal-core";
import { z } from "zod";

import { LoginType } from "../value-objects/login-type.vo.js";
import {
  SessionTrackingId,
  SessionTrackingIdSchema,
} from "../value-objects/session-tracking-id.vo.js";
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
  HashedSessionTokenSchema,
  newPlainSessionToken,
  PlainSessionTokenSchema,
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

// ------------------------------------------------------------------------------
// Session Token Entity
// ------------------------------------------------------------------------------

export const BaseSessionSchema = z.object({
  sessionId: SessionTrackingIdSchema,
  fiscalCode: FiscalCodeSchema,
  name: NonEmptyStringSchema,
  familyName: NonEmptyStringSchema,
  dateOfBirth: z.date(),
  spidLevel: SpidLevelSchema,
  spidEmail: EmailAddressSchema.optional(),
  expirationDate: z.date(),
});

export type BaseSession = z.infer<typeof BaseSessionSchema>;

// ------------------------------------------------------------------------------
// Plain Session Token Value Object
// ------------------------------------------------------------------------------

/**
 * An extension of the BaseSessionSchema that includes a plain session token with tracking ID,
 * representing a unique identifier for the user session.
 */
export const SessionWithPlainTokenSchema = BaseSessionSchema.extend({
  plainSessionToken: PlainSessionTokenSchema,
});

/**
 * A session with a plain session token with tracking ID, representing a unique identifier for the user session.
 */
export type SessionWithPlainToken = z.infer<typeof SessionWithPlainTokenSchema>;

/**
 * An extension of the SessionSchema that includes plain SSO tokens,
 * representing a session with associated SSO tokens in plain text.
 */
export const SessionWithPlainSSOTokensSchema =
  SessionWithPlainTokenSchema.extend({
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
    plainSessionToken: plainSessionToken,
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
export const SessionWithHashedTokenSchema = BaseSessionSchema.extend({
  hashedSessionToken: HashedSessionTokenSchema,
});

/**
 * A session with a hashed session token with tracking ID, representing a unique identifier for the user session.
 * It is used to store the session in a secure way, without exposing the plain session token.
 */
export type SessionWithHashedToken = z.infer<
  typeof SessionWithHashedTokenSchema
>;

/**
 * An extension of the SessionSchema that includes hashed SSO tokens,
 * representing a session with associated SSO tokens that have already been hashed to be stored.
 */
export const SessionWithHashedSSOTokensSchema =
  SessionWithHashedTokenSchema.extend({
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
  const { plainSessionToken, ssoTokens, ...baseData } =
    sessionWithPlainSSOTokens;

  return {
    ...baseData,
    hashedSessionToken: toHashedSessionToken(plainSessionToken),
    ssoTokens: {
      walletHashedToken: toHashedWalletSSOToken(ssoTokens.walletPlainToken),
      bpdHashedToken: toHashedBpdSSOToken(ssoTokens.bpdPlainToken),
      fimsHashedToken: toHashedFimsSSOToken(ssoTokens.fimsPlainToken),
      zendeskHashedToken: toHashedZendeskSSOToken(ssoTokens.zendeskPlainToken),
    },
  };
};
