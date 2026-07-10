import crypto from "crypto";

export function toSha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}
