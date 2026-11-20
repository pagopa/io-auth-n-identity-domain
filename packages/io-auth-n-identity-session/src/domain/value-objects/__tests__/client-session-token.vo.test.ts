import { describe, expect, it } from "vitest";

import { SessionIdSchema } from "../session-id.vo.js";
import { PlainSessionTokenSchema } from "../tokens/index.js";
import {
  ClientSessionTokenSchema,
  HashedClientSessionTokenSchema,
} from "../client-session-token.vo.js";

const aSessionId = SessionIdSchema.parse("aValidSessionId");
const aPlainSessionToken = PlainSessionTokenSchema.parse(
  "aValidPlainSessionToken",
);
const aClientSessionToken = `${aSessionId}.${aPlainSessionToken}`;
const aHashedClientSessionToken = `${aSessionId}.${"a".repeat(64)}`;

describe("ClientSessionTokenSchema", () => {
  it("accepts a session ID and plain token separated by a period", () => {
    expect(ClientSessionTokenSchema.parse(aClientSessionToken)).toBe(
      aClientSessionToken,
    );
  });

  it.each([
    `.${aPlainSessionToken}`,
    `${aSessionId}.`,
    `${aSessionId}${aPlainSessionToken}`,
  ])("rejects malformed client tokens: %s", (value) => {
    expect(ClientSessionTokenSchema.safeParse(value).success).toBe(false);
  });
});

describe("HashedClientSessionTokenSchema", () => {
  it("accepts a session ID and SHA-256 token hash separated by a period", () => {
    expect(
      HashedClientSessionTokenSchema.parse(aHashedClientSessionToken),
    ).toBe(aHashedClientSessionToken);
  });

  it.each([`${aSessionId}.not-a-hash`, `${aSessionId}${"a".repeat(64)}`])(
    "rejects malformed proxy cache keys: %s",
    (value) => {
      expect(HashedClientSessionTokenSchema.safeParse(value).success).toBe(
        false,
      );
    },
  );
});
