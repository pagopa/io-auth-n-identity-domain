import { createHash, randomBytes } from "node:crypto";
import { promisify } from "util";
import { z } from "zod";

export declare const Sha256HexStringBrand: unique symbol;

export const Sha256HexStringSchema = z
  .hash("sha256", { enc: "hex" })
  .brand<typeof Sha256HexStringBrand>();

export type Sha256HexString = z.infer<typeof Sha256HexStringSchema>;

export function toSha256(value: string): Sha256HexString {
  return Sha256HexStringSchema.parse(
    createHash("sha256").update(value).digest("hex"),
  );
}

export const getRandomBytesHex = (length: number): Promise<string> =>
  promisify(randomBytes)(length).then((result) => result.toString("hex"));
