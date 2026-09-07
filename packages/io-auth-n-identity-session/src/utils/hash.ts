import { createHash, randomBytes } from "node:crypto";
import { promisify } from "util";
import { z } from "zod";

export declare const Sha256HexStringBrand: unique symbol;

const Sha256HexZodSchema = z.hash("sha256", { enc: "hex" });

export const Sha256HexStringSchema = Sha256HexZodSchema.brand<
  typeof Sha256HexStringBrand
>().meta({
  format: Sha256HexZodSchema.def.format,
  pattern: Sha256HexZodSchema.def.pattern?.source,
});

export type Sha256HexString = z.infer<typeof Sha256HexStringSchema>;

export function toSha256(value: string): Sha256HexString {
  return Sha256HexStringSchema.parse(
    createHash("sha256").update(value).digest("hex"),
  );
}

export const getRandomBytesHex = (length: number): Promise<string> =>
  promisify(randomBytes)(length).then((result) => result.toString("hex"));
