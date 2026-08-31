import { NonEmptyStringBrand } from "@pagopa/hexagonal-core/domain/value-objects";
import {
  PlainBpdSSOTokenSchema,
  SessionIdSchema,
} from "@pagopa/io-auth-n-identity-session/value-objects";
import z from "zod";

export const _bpdClientSessionTokenBrand: unique symbol = Symbol(
  "BpdClientSessionToken",
);

export const BpdClientSessionTokenSchema = z
  .templateLiteral([SessionIdSchema, ".", PlainBpdSSOTokenSchema])
  .brand(_bpdClientSessionTokenBrand);

export type BpdClientSessionToken = z.infer<typeof BpdClientSessionTokenSchema>;
