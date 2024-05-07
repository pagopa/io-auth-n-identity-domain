import * as crypto from "crypto";
import { promisify } from "util";

/**
 * Generate a new opaque token of the provided lenght
 * @param length the required number of bytes of the token
 * @returns the opaque token
 */
export const getNewToken = (length: number): string =>
  // Use the crypto.randomBytes as token.
  crypto.randomBytes(length).toString("hex");

export const getNewTokenAsync = (length: number): Promise<string> =>
  promisify(crypto.randomBytes)(length).then((result) =>
    result.toString("hex"),
  );
