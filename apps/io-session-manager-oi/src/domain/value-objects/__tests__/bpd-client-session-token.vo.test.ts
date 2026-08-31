import crypto from "node:crypto";

import { describe, expect, it } from "vitest";

import { BpdClientSessionTokenSchema } from "../bpd-client-session-token.vo.js";

const aSessionId = "aValidSessionId";
const aPlainBpdSSOToken = crypto
  .createHash("sha256")
  .update("bpd:aPlainSessionToken")
  .digest("hex");

describe("BpdClientSessionTokenSchema", () => {
  it("accepts a `<sessionId>.<plainBpdSSOToken>` string", () => {
    const raw = `${aSessionId}.${aPlainBpdSSOToken}`;

    const parsed = BpdClientSessionTokenSchema.safeParse(raw);

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).toBe(raw);
    }
  });

  it.each([
    ["missing separator", `${aSessionId}${aPlainBpdSSOToken}`],
    ["empty sessionId", `.${aPlainBpdSSOToken}`],
    ["non-hex plain token", `${aSessionId}.not-a-sha256-hex`],
    ["empty string", ""],
  ])("rejects invalid input (%s)", (_label, raw) => {
    expect(BpdClientSessionTokenSchema.safeParse(raw).success).toBe(false);
  });
});
