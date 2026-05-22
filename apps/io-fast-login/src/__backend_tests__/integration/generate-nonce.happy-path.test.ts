import { afterAll, beforeAll, describe, expect } from "vitest";
import { backendTest as test } from "../support/with-test-fixtures";
import { FunctionHost } from "../support/function-host";
import { callGenerateNonce } from "../support/scenarios";

describe("backend integration | generate-nonce", () => {
  const host = new FunctionHost({
    lollipopBaseUrl: "http://127.0.0.1:65534"
  });

  beforeAll(async () => {
    await host.start();
  }, 60_000);

  afterAll(async () => {
    await host.stop();
  });

  test("stores the generated nonce in real Redis with a live TTL", async ({
    backend
  }) => {
    const response = await callGenerateNonce(host);
    const body = response.body as { nonce: string };

    expect(response.status).toBe(200);
    expect(typeof body.nonce).toBe("string");

    const matchingKeys = await backend.findRedisKeysContaining(body.nonce);

    expect(matchingKeys).toHaveLength(1);
    expect(await backend.redisClient.ttl(matchingKeys[0])).toBeGreaterThan(0);
    expect(await backend.redisClient.ttl(matchingKeys[0])).toBeLessThanOrEqual(
      60
    );
  });
});
