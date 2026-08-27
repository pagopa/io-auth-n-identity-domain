import {
  Sha256HexString,
  Sha256HexStringSchema,
} from "@pagopa/io-auth-n-identity-session";
import { createHash } from "node:crypto";

export const sha256 = (value: string): Sha256HexString =>
  Sha256HexStringSchema.parse(createHash("sha256").update(value).digest("hex"));
