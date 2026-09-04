import crypto from "crypto";
import { promisify } from "util";
import { z } from "zod";

export declare const Sha256HexStringBrand: unique symbol;

export const Sha256HexStringSchema = z
  .string()
  .regex(/^[a-fA-F0-9]{64}$/)
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
