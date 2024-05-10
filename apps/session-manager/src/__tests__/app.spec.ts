import { describe, test, vi } from "vitest";
import request from "supertest";
import { RedisRepo } from "../repositories";
import { mockRedisClientSelector } from "../__mocks__/redis.mocks";

vi.stubEnv(
  "IDP_METADATA_URL",
  "https://api.is.eng.pagopa.it/idp-keys/spid/latest",
);

import { newApp } from "../app";

vi.spyOn(RedisRepo, "RedisClientSelector").mockImplementation(
  () => async () => mockRedisClientSelector,
);

const X_FORWARDED_PROTO_HEADER = "X-Forwarded-Proto";

describe("Test redirect to HTTPS", async () => {
  const app = await newApp({});
  // test case: ping. Cannot fail.
  test("should 200 and ok if pinged", async () => {
    await request(app).get("/healthcheck").expect(200, "ok");
  });

  // test case: https forced. Already set: it trust the proxy and accept the header: X-Forwarded-Proto.
  test("should respond 200 if forwarded from an HTTPS connection", async () => {
    await request(app)
      .get("/healthcheck")
      .set(X_FORWARDED_PROTO_HEADER, "https")
      .expect(200);
  });
});
