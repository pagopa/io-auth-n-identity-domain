import { z } from "zod";

import {
  HashedBpdSSOTokenSchema,
  PlainBpdSSOTokenSchema,
} from "./bpd-sso-token.vo.js";
import {
  HashedFimsSSOTokenSchema,
  PlainFimsSSOTokenSchema,
} from "./fims-sso-token.vo.js";
import {
  HashedWalletSSOTokenSchema,
  PlainWalletSSOTokenSchema,
} from "./wallet-sso-token.vo.js";
import {
  HashedZendeskSSOTokenSchema,
  PlainZendeskSSOTokenSchema,
} from "./zendesk-sso-token.vo.js";

// ------------------------------------------------------------------------------
// Plain SSO Tokens Value Object
// ------------------------------------------------------------------------------

export const PlainSSOTokensSchema = z.object({
  bpdPlainToken: PlainBpdSSOTokenSchema,
  walletPlainToken: PlainWalletSSOTokenSchema,
  zendeskPlainToken: PlainZendeskSSOTokenSchema,
  fimsPlainToken: PlainFimsSSOTokenSchema,
});

export type PlainSSOTokens = z.infer<typeof PlainSSOTokensSchema>;

// ------------------------------------------------------------------------------
// Hashed SSO Tokens Value Object
// ------------------------------------------------------------------------------

export const HashedSSOTokensSchema = z.object({
  bpdHashedToken: HashedBpdSSOTokenSchema,
  walletHashedToken: HashedWalletSSOTokenSchema,
  zendeskHashedToken: HashedZendeskSSOTokenSchema,
  fimsHashedToken: HashedFimsSSOTokenSchema,
});

export type HashedSSOTokens = z.infer<typeof HashedSSOTokensSchema>;
