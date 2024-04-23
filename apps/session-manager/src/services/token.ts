import * as crypto from "crypto";

export const getNewToken = (length: number): string =>
  // Use the crypto.randomBytes as token.
  crypto.randomBytes(length).toString("hex");
