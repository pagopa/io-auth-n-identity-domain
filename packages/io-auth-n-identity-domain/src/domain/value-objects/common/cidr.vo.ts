import { z } from "zod";

// Strict IPv4 CIDR: each octet 0–255, prefix /0–/32.
const OCTET = "(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)";
const CIDR_PATTERN = new RegExp(
  `^${OCTET}(?:\\.${OCTET}){3}\\/(?:3[0-2]|[12]?\\d)$`,
);

/**
 * A single IPv4 CIDR block in `A.B.C.D/N` notation.
 * Bare IPv4 addresses are normalized to `/32` before validation.
 */
export const CidrSchema = z.preprocess(
  (value) =>
    typeof value === "string" && value.length > 0 && !value.includes("/")
      ? `${value}/32`
      : value,
  z
    .string()
    .regex(CIDR_PATTERN, "Invalid IPv4 CIDR")
);

export type Cidr = z.infer<typeof CidrSchema>;

/**
 * A comma-separated list of IPv4 addresses or CIDR blocks.
 * Bare IPs are normalized to `/32`. Empty entries are ignored.
 */
export const CidrListSchema = z.string().transform((raw, ctx) => {
  const items = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const parsed: Cidr[] = [];
  for (const item of items) {
    const result = CidrSchema.safeParse(item);
    if (!result.success) {
      ctx.addIssue({
        code: "custom",
        message: `Invalid CIDR entry: ${item}`,
      });
      return z.NEVER;
    }
    parsed.push(result.data);
  }

  return parsed as ReadonlyArray<Cidr>;
});

export type CidrList = z.infer<typeof CidrListSchema>;
