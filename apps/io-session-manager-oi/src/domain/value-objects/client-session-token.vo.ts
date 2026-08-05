import z from "zod";

import {
  PlainSessionTokenSchema,
  SessionIdSchema,
} from "@pagopa/io-auth-n-identity-session/value-objects";

export const ClientSessionTokenSchema = z
  .templateLiteral([SessionIdSchema, ".", PlainSessionTokenSchema])
  .brand<"ClientSessionToken">();

export type ClientSessionToken = z.infer<typeof ClientSessionTokenSchema>;
