import {
  HashedBpdSSOToken,
  HashedSessionToken,
  PlainBpdSSOToken,
  PlainBpdSSOTokenSchema,
  PlainSessionToken,
  PlainSessionTokenSchema,
  HashedFimsSSOToken,
  PlainFimsSSOToken,
  PlainFimsSSOTokenSchema,
  PlainPagoPaSSOToken,
  HashedPagoPaSSOToken,
  PlainPagoPaSSOTokenSchema,
} from "@pagopa/io-auth-n-identity-session";

export type AuthToken = {
  session: {
    schema: typeof PlainSessionTokenSchema;
    type: PlainSessionToken;
    hashedType: HashedSessionToken;
  };
  bpd: {
    schema: typeof PlainBpdSSOTokenSchema;
    type: PlainBpdSSOToken;
    hashedType: HashedBpdSSOToken;
  };
  fims: {
    schema: typeof PlainFimsSSOTokenSchema;
    type: PlainFimsSSOToken;
    hashedType: HashedFimsSSOToken;
  };
  pagopa: {
    schema: typeof PlainPagoPaSSOTokenSchema;
    type: PlainPagoPaSSOToken;
    hashedType: HashedPagoPaSSOToken;
  }
};

export type TokenType = keyof AuthToken;

export const AuthToken = {
  session: { schema: PlainSessionTokenSchema },
  bpd: { schema: PlainBpdSSOTokenSchema },
  fims: { schema: PlainFimsSSOTokenSchema },
  pagopa: { schema: PlainPagoPaSSOTokenSchema },
} as const satisfies {
  [T in TokenType]: Omit<AuthToken[T], "type" | "hashedType">;
};
