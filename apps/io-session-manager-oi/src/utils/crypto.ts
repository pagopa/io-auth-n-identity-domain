import { createHash } from "node:crypto";

export namespace Hash {
  export const sha256 = (value: string): string => {
    return createHash("sha256").update(value).digest("hex");
  };
}
