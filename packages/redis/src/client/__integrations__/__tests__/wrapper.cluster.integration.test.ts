import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import {
  type RedisClusterClient,
  createRedisClusterClient,
} from "../../../cluster-client/factory.js";
import { RedisSetWrapper } from "../../wrapper.js";
import {
  LOCAL_DOCKER_NODE_ADDRESS_MAP,
  REDIS_PASSWORD,
  REDIS_PORT,
  REDIS_TLS_ENABLED,
  REDIS_URL,
} from "../env.js";
import { ok } from "neverthrow";

const KEY = `TEST-SET-${Date.now()}-${Math.floor(Math.random() * 1_000)}`;
const MEMBERS = ["ISPXNB32R82Y766D", "PLMPRS80A01F205Z"] as const;

// Members are 16-char uppercase alphanumeric strings (fiscal-code-shaped).
// The regex mirrors the constraint of the real `FiscalCodeSchema` from
// `@pagopa/hexagonal-core` without pulling the branded type into the
// integration suite.
const MemberSchema = z.string().regex(/^[A-Z0-9]{16}$/);

describe("RedisSetWrapper + createRedisClusterClient (integration - Redis Cluster)", () => {
  let safeClient: RedisClusterClient;
  let safeWrapper: RedisSetWrapper;

  beforeAll(async () => {
    safeClient = await createRedisClusterClient({
      url: REDIS_URL,
      port: REDIS_PORT,
      password: REDIS_PASSWORD,
      enableTls: REDIS_TLS_ENABLED,
      useReplicas: false, // For deterministic round-trip assertions
      nodeAddressMap: LOCAL_DOCKER_NODE_ADDRESS_MAP,
    });
    safeWrapper = new RedisSetWrapper(safeClient, MemberSchema);
  });

  afterEach(async () => {
    await safeClient.del(KEY).catch(() => undefined);
  });

  afterAll(async () => {
    await safeClient.del(KEY);
    await safeClient.quit();
  });

  // -------------------------------------------------------------------------
  // Round-trip
  // -------------------------------------------------------------------------

  describe("isMember / add / rem round-trip", () => {
    it("isMember reports non-membership on a fresh key", async () => {
      const result = await safeWrapper.isMember(KEY, MEMBERS[0]);
      expect(result).toEqual(ok(false));
    });

    it("add then isMember reports membership", async () => {
      const added = await safeWrapper.add(KEY, MEMBERS[0]);
      expect(added).toEqual(ok(1));

      const isMember = await safeWrapper.isMember(KEY, MEMBERS[0]);
      expect(isMember).toEqual(ok(true));
    });

    it("add is idempotent — a second add reports 0", async () => {
      await safeWrapper.add(KEY, MEMBERS[0]);
      const second = await safeWrapper.add(KEY, MEMBERS[0]);
      expect(second).toEqual(ok(0));
    });

    it("rem then isMember reports non-membership", async () => {
      await safeWrapper.add(KEY, MEMBERS[0]);
      const removed = await safeWrapper.rem(KEY, MEMBERS[0]);
      expect(removed).toEqual(ok(1));

      const isMember = await safeWrapper.isMember(KEY, MEMBERS[0]);
      expect(isMember).toEqual(ok(false));
    });

    it("rem is idempotent — removing an absent member reports 0", async () => {
      const removed = await safeWrapper.rem(KEY, MEMBERS[1]);
      expect(removed).toEqual(ok(0));
    });
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
        createRedisClusterClient({
          url: REDIS_URL,
          port: REDIS_PORT,
          password: "definitely-not-the-password",
          enableTls: REDIS_TLS_ENABLED,
          useReplicas: false,
          nodeAddressMap: LOCAL_DOCKER_NODE_ADDRESS_MAP,
        }),
      ).rejects.toThrow(/WRONGPASS|NOAUTH/);
    });
  });
});

describe("RedisSetWrapper + createRedisClusterClient (integration - Redis Cluster) - fast client", () => {
  let fastClient: RedisClusterClient;
  let fastWrapper: RedisSetWrapper;

  beforeAll(async () => {
    fastClient = await createRedisClusterClient({
      url: REDIS_URL,
      port: REDIS_PORT,
      password: REDIS_PASSWORD,
      enableTls: REDIS_TLS_ENABLED,
      useReplicas: true,
      nodeAddressMap: LOCAL_DOCKER_NODE_ADDRESS_MAP,
    });
    fastWrapper = new RedisSetWrapper(fastClient, MemberSchema);
  });

  afterEach(async () => {
    await fastClient.del(KEY).catch(() => undefined);
  });

  afterAll(async () => {
    await fastClient.del(KEY);
    await fastClient.quit();
  });

  it.each(Array.from({ length: MEMBERS.length }, (_, i) => i + 1))(
    "adding %i member(s) reports the number of newly-added members",
    async (count) => {
      const slice = MEMBERS.slice(0, count);
      expect(await fastWrapper.add(KEY, slice)).toStrictEqual(ok(count));
    },
  );
});
