import { describe, test, vi, expect, afterAll } from "vitest";
import request from "supertest";
import { RedisRepo } from "../repositories";
import {
  mockQuit,
  mockRedisClientSelector,
  mockSelect,
} from "../__mocks__/redis.mocks";

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

  afterAll(() => {
    app.emit("server:stop");
  });
  // test case: ping. Cannot fail.
  test("should 200 and ok if heathcheck API is called", async () => {
    await request(app).get("/healthcheck").expect(200, "ok");
  });

  // test case: https forced. Already set: it trust the proxy and accept the header: X-Forwarded-Proto.
  test("should respond 200 if forwarded from an HTTPS connection", async () => {
    await request(app)
      .get("/healthcheck")
      .set(X_FORWARDED_PROTO_HEADER, "https")
      .expect(200);
  });

  test("should call quit method for each redis when the server stops", async () => {
    app.emit("server:stop");
    expect(mockQuit).toBeCalledTimes(mockSelect().length);
  });
});
