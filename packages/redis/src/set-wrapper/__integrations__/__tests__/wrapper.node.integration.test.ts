import { ok } from "neverthrow";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import {
  createRedisNodeClient,
  type RedisNodeClient,
} from "../../../node-client/factory.js";
import { RedisSetWrapper } from "../../set-wrapper.js";
import {
  REDIS_STANDALONE_PASSWORD,
  REDIS_STANDALONE_PORT,
  REDIS_STANDALONE_TLS_ENABLED,
  REDIS_STANDALONE_URL,
} from "../env.js";

const KEY = `TEST-SET-${Date.now()}-${Math.floor(Math.random() * 1_000)}`;
const MEMBERS = ["ISPXNB32R82Y766D", "PLMPRS80A01F205Z"] as const;

// Members are 16-char uppercase alphanumeric strings (fiscal-code-shaped).
// The regex mirrors the constraint of the real `FiscalCodeSchema` from
// `@pagopa/hexagonal-core` without pulling the branded type into the
// integration suite.
const MemberSchema = z.string().regex(/^[A-Z0-9]{16}$/);

describe("RedisSetWrapper + createRedisNodeClient (integration - Redis standalone)", () => {
  let client: RedisNodeClient;
  let wrapper: RedisSetWrapper<typeof MemberSchema, RedisNodeClient>;

  beforeAll(async () => {
    client = await createRedisNodeClient({
      url: REDIS_STANDALONE_URL,
      port: REDIS_STANDALONE_PORT,
      password: REDIS_STANDALONE_PASSWORD,
      enableTls: REDIS_STANDALONE_TLS_ENABLED,
    });
    wrapper = new RedisSetWrapper(client, MemberSchema);
  });

  afterEach(async () => {
    await client.del(KEY).catch(() => undefined);
  });

  afterAll(async () => {
    await client.del(KEY);
    await client.quit();
  });

  // -------------------------------------------------------------------------
  // Round-trip
  // -------------------------------------------------------------------------

  describe("isMember / add / rem round-trip", () => {
    it("isMember reports non-membership on a fresh key", async () => {
      const result = await wrapper.isMember(KEY, MEMBERS[0]);
      expect(result).toEqual(ok(false));
    });

    it("add then isMember reports membership", async () => {
      const added = await wrapper.add(KEY, MEMBERS[0]);
      expect(added).toEqual(ok(1));

      const isMember = await wrapper.isMember(KEY, MEMBERS[0]);
      expect(isMember).toEqual(ok(true));
    });

    it("add is idempotent — a second add reports 0", async () => {
      await wrapper.add(KEY, MEMBERS[0]);
      const second = await wrapper.add(KEY, MEMBERS[0]);
      expect(second).toEqual(ok(0));
    });

    it("rem then isMember reports non-membership", async () => {
      await wrapper.add(KEY, MEMBERS[0]);
      const removed = await wrapper.rem(KEY, MEMBERS[0]);
      expect(removed).toEqual(ok(1));

      const isMember = await wrapper.isMember(KEY, MEMBERS[0]);
      expect(isMember).toEqual(ok(false));
    });

    it("rem is idempotent — removing an absent member reports 0", async () => {
      const removed = await wrapper.rem(KEY, MEMBERS[1]);
      expect(removed).toEqual(ok(0));
    });
  });

  // -------------------------------------------------------------------------
  // Array-mode SADD
  // -------------------------------------------------------------------------

  describe("SADD with an array of members", () => {
    it.each(Array.from({ length: MEMBERS.length }, (_, i) => i + 1))(
      "adding %i member(s) reports the number of newly-added members",
      async (count) => {
        const slice = MEMBERS.slice(0, count);
        expect(await wrapper.add(KEY, slice)).toStrictEqual(ok(count));
      },
    );
  });

  // -------------------------------------------------------------------------
  // Error classification against the real server
  // -------------------------------------------------------------------------

  describe("error classification", () => {
    it("surfaces WRONGPASS/NOAUTH when the password is wrong", async () => {
      // node-redis raises the auth error during `connect()`, not on the
      // first command — the client never becomes usable. Assert on the
      // thrown error directly, and don't attempt any wrapper operation.
      await expect(
        createRedisNodeClient({
          url: REDIS_STANDALONE_URL,
          port: REDIS_STANDALONE_PORT,
          password: "definitely-not-the-password",
          enableTls: REDIS_STANDALONE_TLS_ENABLED,
        }),
      ).rejects.toThrow(/WRONGPASS|NOAUTH/);
    });
  });
});
