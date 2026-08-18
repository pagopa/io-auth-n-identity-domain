import z from "zod";

import {
  HashedSessionTokenSchema,
  PlainSessionTokenSchema,
  _plainSessionTokenBrand,
  SessionIdSchema,
  _sessionIdBrand,
} from "@pagopa/io-auth-n-identity-session/value-objects";

import { NonEmptyStringBrand } from "@pagopa/hexagonal-core/domain/value-objects";

export const _clientSessionTokenBrand: unique symbol =
  Symbol("ClientSessionToken");

export const ClientSessionTokenSchema = z
  .templateLiteral([SessionIdSchema, ".", PlainSessionTokenSchema])
  .brand(_clientSessionTokenBrand);

export type ClientSessionToken = z.infer<typeof ClientSessionTokenSchema>;

export const HashedClientSessionTokenSchema = z
  .templateLiteral([SessionIdSchema, ".", HashedSessionTokenSchema])
  .brand<"HashedClientSessionToken">();

export type HashedClientSessionToken = z.infer<
  typeof HashedClientSessionTokenSchema
>;
