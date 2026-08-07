import {
  EmailAddressSchema,
  EmailAddressBrand,
  FiscalCodeSchema,
  FiscalCodeBrand,
  GenericError,
  NonEmptyStringSchema,
  NonEmptyStringBrand,
  NotFoundError,
} from "@pagopa/hexagonal-core";
import {
  SessionWithHashedSSOTokens,
  SessionWithPlainSSOTokens,
  toHashedSession,
} from "@pagopa/io-auth-n-identity-session/entities";
import {
  PlainSessionTokenSchema,
  SessionIdSchema,
  SpidLevelSchema,
  toPlainBpdSSOToken,
  toPlainFimsSSOToken,
  toPlainWalletSSOToken,
  toPlainZendeskSSOToken,
} from "@pagopa/io-auth-n-identity-session/value-objects";

import { UserProfile } from "../domain/entities/profile.entity.js";
import { type NewSessionToken } from "../application/use-cases/activate-user-session.use-case.js";

export const aFiscalCode = FiscalCodeSchema.parse("ISPXNB32R82Y766D");
export const anEmailAddress = EmailAddressSchema.parse("user@example.com");
export const aName = NonEmptyStringSchema.parse("Mario");
export const aFamilyName = NonEmptyStringSchema.parse("Rossi");
export const anIdentityProvider = NonEmptyStringSchema.parse("spid");
export const aSpidLevel = SpidLevelSchema.parse(
  "https://www.spid.gov.it/SpidL2",
);
export const aDateOfBirth = new Date("1985-10-10");
export const anIpAddress = "127.0.0.1";

export const aSessionId = SessionIdSchema.parse("aValidSessionId");
export const aPlainSessionToken = PlainSessionTokenSchema.parse(
  "aValidPlainSessionToken",
);

export const aClientSessionToken = `${aSessionId}.${aPlainSessionToken}`;

export const aNewSessionTokenInput: NewSessionToken = {
  fiscalCode: aFiscalCode,
  name: aName,
  familyName: aFamilyName,
  dateOfBirth: aDateOfBirth,
  spidLevel: aSpidLevel,
  spidEmail: anEmailAddress,
  ipAddress: anIpAddress,
  loginType: "LEGACY",
  identityProvider: anIdentityProvider,
};

export const aNewSessionTokenInputWithoutSpidEmail: NewSessionToken = {
  ...aNewSessionTokenInput,
  spidEmail: undefined,
};

export const aSessionWithPlainTokens: SessionWithPlainSSOTokens = {
  sessionId: aSessionId,
  fiscalCode: aFiscalCode,
  name: aName,
  familyName: aFamilyName,
  dateOfBirth: aDateOfBirth,
  spidLevel: aSpidLevel,
  spidEmail: anEmailAddress,
  expirationDate: new Date("2100-01-01"),
  plainSessionToken: aPlainSessionToken,
  ssoTokens: {
    walletPlainToken: toPlainWalletSSOToken(aPlainSessionToken),
    bpdPlainToken: toPlainBpdSSOToken(aPlainSessionToken),
    fimsPlainToken: toPlainFimsSSOToken(aPlainSessionToken),
    zendeskPlainToken: toPlainZendeskSSOToken(aPlainSessionToken),
  },
};

export const aSessionWithHashedTokens: SessionWithHashedSSOTokens =
  toHashedSession(aSessionWithPlainTokens);

export const aUserProfileWithEmail: UserProfile = {
  fiscalCode: aFiscalCode,
  email: anEmailAddress,
  isEmailValidated: true,
};

export const aUserProfileWithoutEmail: UserProfile = {
  fiscalCode: aFiscalCode,
  isEmailValidated: false,
};

export const aGenericError = new GenericError("boom");
export const aNotFoundError = new NotFoundError("Profile", "not found");
