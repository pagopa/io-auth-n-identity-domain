import { createHash } from "node:crypto";

import {
  Sha256HexString,
  Sha256HexStringSchema,
} from "@pagopa/io-auth-n-identity-session";

export const sha256 = (value: string): Sha256HexString =>
  Sha256HexStringSchema.parse(createHash("sha256").update(value).digest("hex"));
