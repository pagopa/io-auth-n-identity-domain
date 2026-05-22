import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  ASSERTION_REF,
  PROXY_BASE_PATH,
  SESSION_USER,
} from "../support/fixtures";
import { createBackendTestHarness } from "../support/runtime";

describe("backend integration | logout", () => {
  let harness: Awaited<ReturnType<typeof createBackendTestHarness>>;

  beforeAll(async () => {
    harness = await createBackendTestHarness();
  });

  beforeEach(async () => {
    await harness.reset();
  });

  afterAll(async () => {
    await harness.close();
  });

  it("deletes the session and emits the observable side effects", async () => {
    await harness.redis.seedUserSession(SESSION_USER, 3600);
    await harness.redis.seedLollipopAssertionRef(
      SESSION_USER.fiscal_code,
      ASSERTION_REF,
      3600,
    );

    const response = await harness.http
      .post(`${PROXY_BASE_PATH}/logout`)
      .set("Authorization", `Bearer ${SESSION_USER.session_token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ message: "ok" });
    expect(
      harness.redis.getStringValue(`SESSION-${SESSION_USER.session_token}`),
    ).toBeUndefined();
    expect(
      harness.redis.getStringValue(`KEYS-${SESSION_USER.fiscal_code}`),
    ).toBeUndefined();
    expect(
      harness.redis.getSetMembers(`USERSESSIONS-${SESSION_USER.fiscal_code}`),
    ).toEqual([]);
    expect(harness.platformInternalDeletes).toEqual([
      {
        headers: {
          "x-session-token": SESSION_USER.session_token,
        },
        method: "DELETE",
        path: "/sessions",
      },
    ]);
    expect(harness.readDecodedLollipopQueueMessages()).toEqual([
      {
        assertion_ref: ASSERTION_REF,
      },
    ]);
    expect(harness.serviceBusMessages).toEqual([
      {
        message: {
          applicationProperties: {
            eventType: "logout",
          },
          body: {
            eventType: "logout",
            fiscalCode: SESSION_USER.fiscal_code,
            scenario: "app",
            ts: expect.any(Number),
          },
          contentType: "application/json",
          sessionId: SESSION_USER.fiscal_code,
        },
        topicName: "backend-test-auth-sessions-topic",
      },
    ]);
  });
});
