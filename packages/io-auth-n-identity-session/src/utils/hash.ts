import crypto from "crypto";
import { promisify } from "util";
import { z } from "zod";

export const SHA256_HEX_STRING_LENGTH = 64;

export declare const Sha256HexStringBrand: unique symbol;

export const Sha256HexStringSchema = z
  .string()
  .regex(new RegExp(`^[a-fA-F0-9]{${SHA256_HEX_STRING_LENGTH}}$`))
  .brand<typeof Sha256HexStringBrand>();

export type Sha256HexString = z.infer<typeof Sha256HexStringSchema>;

export function toSha256(value: string): Sha256HexString {
  return Sha256HexStringSchema.parse(
    crypto.createHash("sha256").update(value).digest("hex"),
  );
}

export const getRandomBytesHex = (length: number): Promise<string> =>
  promisify(crypto.randomBytes)(length).then((result) =>
    result.toString("hex"),
  );
