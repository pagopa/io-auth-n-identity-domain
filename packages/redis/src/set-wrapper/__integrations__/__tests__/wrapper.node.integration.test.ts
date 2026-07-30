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
import { ValidationError } from "@pagopa/hexagonal-core";

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

// -------------------------------------------------------------------------
// Zod schema type inference
// -------------------------------------------------------------------------

describe("RedisSetWrapper — schema capabilities", () => {
  describe("RedisSetWrapper — branded vs unbranded schema", () => {
    const commonRegex = /^[A-Z0-9]{16}$/;
    // A Schema that brands a string as a "Member" type. The wrapper should accept only values of this branded type.
    const BrandedMemberSchema = z.string().regex(commonRegex).brand("Member");
    // A Schema that accepts unbranded strings matching the same regex.
    const UnbrandedMemberSchema = z.string().regex(commonRegex);

    let client: RedisNodeClient;
    let brandedWrapper: RedisSetWrapper<
      typeof BrandedMemberSchema,
      RedisNodeClient
    >;
    let unbrandedWrapper: RedisSetWrapper<
      typeof UnbrandedMemberSchema,
      RedisNodeClient
    >;

    beforeAll(async () => {
      client = await createRedisNodeClient({
        url: REDIS_STANDALONE_URL,
        port: REDIS_STANDALONE_PORT,
        password: REDIS_STANDALONE_PASSWORD,
        enableTls: REDIS_STANDALONE_TLS_ENABLED,
      });
      brandedWrapper = new RedisSetWrapper(client, BrandedMemberSchema);
      unbrandedWrapper = new RedisSetWrapper(client, UnbrandedMemberSchema);
    });

    afterAll(async () => {
      await client.close();
    });

    it("accepts values produced by the schema (positive case, compile time)", async () => {
      const validatedBranded = BrandedMemberSchema.parse(MEMBERS[0]);
      const brandedResult = await brandedWrapper.add(KEY, validatedBranded);
      expect(brandedResult).toEqual(ok(1));
      // Now we remove the branded member to clean up for the next test
      const brandedRemoveResult = await brandedWrapper.rem(
        KEY,
        validatedBranded,
      );
      expect(brandedRemoveResult).toEqual(ok(1));

      const validatedUnbranded = UnbrandedMemberSchema.parse(MEMBERS[0]);
      const unbrandedResult = await unbrandedWrapper.add(
        KEY,
        validatedUnbranded,
      );
      expect(unbrandedResult).toEqual(ok(1));
      // Now we remove the unbranded member to clean up for the next test
      const unbrandedRemoveResult = await unbrandedWrapper.rem(
        KEY,
        validatedUnbranded,
      );
      expect(unbrandedRemoveResult).toEqual(ok(1));

      const brandedIntoUnbrandedResult = await unbrandedWrapper.add(
        KEY,
        validatedBranded,
      );
      expect(brandedIntoUnbrandedResult).toEqual(ok(1));

      // The following line will fail to compile
      await brandedWrapper.add(
        KEY,
        // @ts-expect-error — the branded schema is not assignable to the unbranded schema at compile time.
        validatedUnbranded,
      );
    });

    it("rejects raw strings at compile time (no runtime call)", () => {
      // Each `@ts-expect-error` becomes a compile error itself if the
      // wrapper's contract accidentally loosens — the assertion is
      // enforced at type-check time, not at runtime.

      // @ts-expect-error
      void brandedWrapper.add(KEY, "");

      // @ts-expect-error
      void brandedWrapper.add(KEY, ["", ""]);

      // No runtime assertions — this test is the compile-time contract.
      expect.assertions(0);
    });
  });

  describe("RedisSetWrapper — schema with encode/decode (stringToDate)", () => {
    // A Schema that encodes/decodes between ISO date strings and Date objects.
    const stringToDate = z.codec(
      z.iso.datetime(), // input schema: ISO date string
      z.date(), // output schema: Date object
      {
        decode: (isoString) => new Date(isoString), // ISO string → Date
        encode: (date) => date.toISOString(), // Date → ISO string
      },
    );

    let client: RedisNodeClient;
    let dateWrapper: RedisSetWrapper<typeof stringToDate, RedisNodeClient>;

    beforeAll(async () => {
      client = await createRedisNodeClient({
        url: REDIS_STANDALONE_URL,
        port: REDIS_STANDALONE_PORT,
        password: REDIS_STANDALONE_PASSWORD,
        enableTls: REDIS_STANDALONE_TLS_ENABLED,
      });
      dateWrapper = new RedisSetWrapper(client, stringToDate);
    });

    afterAll(async () => {
      await client.close();
    });

    it("accepts a Date object and encodes it to ISO string for Redis", async () => {
      const date = new Date();
      const result = await dateWrapper.add(KEY, date);
      expect(result).toEqual(ok(1));

      const isMemberResult = await dateWrapper.isMember(KEY, date);
      expect(isMemberResult).toEqual(ok(true));
    });

    it("rejects an invalid Date object at runtime", async () => {
      const invalidDate = new Date("invalid-date-string");
      const result = await dateWrapper.add(KEY, invalidDate);
      expect(result.isErr()).toBe(true);
    });

    it("rejects an ISO string at runtime", async () => {
      const isoString = new Date().toISOString();
      const result = await dateWrapper.add(KEY, isoString as unknown as Date);
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(ValidationError);
    });
  });

  describe("RedisSetWrapper — Zod Object (via JSON codec)", () => {
    const ObjectSchema = z.object({
      id: z.uuid(),
      name: z.string(),
      email: z.string().email(),
    });
    const JsonObjectCodec = z.codec(
      z.string(), // wire (input): raw JSON string
      ObjectSchema, // domain (output): validated object
      {
        decode: (s) => JSON.parse(s) as z.input<typeof ObjectSchema>,
        encode: (obj) => JSON.stringify(obj),
      },
    );

    let client: RedisNodeClient;
    let objectWrapper: RedisSetWrapper<typeof JsonObjectCodec, RedisNodeClient>;

    beforeAll(async () => {
      client = await createRedisNodeClient({
        url: REDIS_STANDALONE_URL,
        port: REDIS_STANDALONE_PORT,
        password: REDIS_STANDALONE_PASSWORD,
        enableTls: REDIS_STANDALONE_TLS_ENABLED,
      });
      objectWrapper = new RedisSetWrapper(client, JsonObjectCodec);
    });

    afterEach(async () => {
      await client.del(KEY).catch(() => undefined);
    });

    afterAll(async () => {
      await client.close();
    });

    it("accepts an object matching the schema", async () => {
      const obj = {
        id: "550e8400-e29b-41d4-a716-446655440000",
        name: "Test",
        email: "test@example.com",
      };
      const result = await objectWrapper.add(KEY, obj);
      expect(result).toEqual(ok(1));

      const isMemberResult = await objectWrapper.isMember(KEY, obj);
      expect(isMemberResult).toEqual(ok(true));
    });

    it("rejects an object failing schema validation at runtime", async () => {
      const invalidObj = {
        id: "not-a-uuid",
        name: "Test",
        email: "invalid-email",
      };
      const result = await objectWrapper.add(KEY, invalidObj);
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(ValidationError);
    });

    it("successfully round-trips an object after zod parse on different orders", async () => {
      const id = "550e8400-e29b-41d4-a716-446655440000";
      const name = "Test";
      const email = "test@example.com";

      const obj = { id, name, email };
      const differentOrderObj = { email, id, name };

      const parsedObj = ObjectSchema.parse(obj);
      const result = await objectWrapper.add(KEY, parsedObj);
      expect(result).toEqual(ok(1));

      const differentOrderParsedObj = ObjectSchema.parse(differentOrderObj);
      const isMemberResult = await objectWrapper.isMember(
        KEY,
        differentOrderParsedObj,
      );
      expect(isMemberResult).toEqual(ok(true));

      // Be careful: the above works because Zod's parse method normalizes the object according to the schema, 
      // so the order of keys does not matter for validation.
      expect(parsedObj).toEqual(differentOrderParsedObj);
      expect(JSON.stringify(parsedObj)).toEqual(JSON.stringify(differentOrderParsedObj));

      // But it would not work if we directly compared the original objects without parsing, as their key order differs.
      expect(JSON.stringify(obj)).not.toEqual(JSON.stringify(differentOrderObj));

      // This shows up for example if we compare Zod parsed objects with loose validation (passthrough)
      const loose1 = ObjectSchema.loose().parse({
        id, name, email, extra_1: "field", extra_2: "field",
      });
      const loose2 = ObjectSchema.loose().parse({
        email, id, name, extra_2: "field", extra_1: "field",
      });
      expect(loose1).toEqual(loose2);
      expect(JSON.stringify(loose1)).not.toEqual(JSON.stringify(loose2));
    });
  });
});
