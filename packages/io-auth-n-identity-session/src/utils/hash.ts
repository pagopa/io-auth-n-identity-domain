import crypto from "crypto";
import { promisify } from "util";

export function toSha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export const getRandomBytesHex = (length: number): Promise<string> =>
  promisify(crypto.randomBytes)(length).then((result) =>
    result.toString("hex"),
  );
