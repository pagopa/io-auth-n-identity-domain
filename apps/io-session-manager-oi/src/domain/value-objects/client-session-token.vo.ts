import z from "zod";

import {
  HashedSessionTokenSchema,
  PlainSessionTokenSchema,
  SessionIdSchema,
} from "@pagopa/io-auth-n-identity-session/value-objects";

export const ClientSessionTokenSchema = z
  .templateLiteral([SessionIdSchema, ".", PlainSessionTokenSchema])
  .brand<"ClientSessionToken">();

export type ClientSessionToken = z.infer<typeof ClientSessionTokenSchema>;

export const HashedClientSessionTokenSchema = z
  .templateLiteral([SessionIdSchema, ".", HashedSessionTokenSchema])
  .brand<"HashedClientSessionToken">();

export type HashedClientSessionToken = z.infer<
  typeof HashedClientSessionTokenSchema
>;
