import { describe, test, vi, afterAll } from "vitest";
import request from "supertest";
import { RedisRepo } from "../repositories";
import { mockRedisClientSelector } from "../__mocks__/redis.mocks";

vi.stubEnv(
  "IDP_METADATA_URL",
  "https://api.is.eng.pagopa.it/idp-keys/spid/latest",
);

vi.spyOn(RedisRepo, "RedisClientSelector").mockImplementation(
  () => async () => mockRedisClientSelector,
);

import { newApp } from "../app";
import { getCurrentBackendVersion } from "../utils/package";

const X_FORWARDED_PROTO_HEADER = "X-Forwarded-Proto";
const STOP_EVENT_NAME = "server:stop";

afterAll(() => {
  vi.restoreAllMocks();
});

describe("Test redirect to HTTPS", async () => {
  const { app } = await newApp({});

  afterAll(() => {
    app.emit(STOP_EVENT_NAME);
  });
  // test case: ping. Cannot fail.
  test("should 200 and ok if heathcheck API is called", async () => {
    await request(app)
      .get("/healthcheck")
      .expect(200, JSON.stringify({ version: getCurrentBackendVersion() }));
  });

  // test case: https forced. Already set: it trust the proxy and accept the header: X-Forwarded-Proto.
  test("should respond 200 if forwarded from an HTTPS connection", async () => {
    await request(app)
      .get("/healthcheck")
      .set(X_FORWARDED_PROTO_HEADER, "https")
      .expect(200);
  });
});
