import { z } from "zod";

import { type SessionId, SessionIdSchema } from "./session-id.vo.js";
import {
  type HashedSessionToken,
  HashedSessionTokenSchema,
  type PlainSessionToken,
  PlainSessionTokenSchema,
} from "./tokens/index.js";

// Use public type aliases so declaration emit can avoid expanding unique-symbol brands (TS2527).
export const ClientSessionTokenSchema: z.ZodTemplateLiteral<`${SessionId}.${PlainSessionToken}`> =
  z.templateLiteral([SessionIdSchema, ".", PlainSessionTokenSchema]);

export type ClientSessionToken = z.infer<typeof ClientSessionTokenSchema>;

// Use public type aliases so declaration emit can avoid expanding unique-symbol brands (TS2527).
export const HashedClientSessionTokenSchema: z.ZodTemplateLiteral<`${SessionId}.${HashedSessionToken}`> =
  z.templateLiteral([SessionIdSchema, ".", HashedSessionTokenSchema]);

export type HashedClientSessionToken = z.infer<
  typeof HashedClientSessionTokenSchema
>;
