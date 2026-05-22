import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  ASSERTION_REF,
  PROXY_BASE_PATH,
  SESSION_USER,
} from "../support/fixtures";
import { recordOrVerifyScenario, replaceDeep } from "../support/record-replay";
import { createBackendTestHarness } from "../support/runtime";

describe("backend record-replay | logout", () => {
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

  it("freezes the logout flow and side effects", async () => {
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

    await recordOrVerifyScenario("logout-app-flow", {
      normalization: {
        dynamicFields: ["sideEffects.serviceBus[0].message.body.ts"],
        placeholders: ["<LOGOUT_TIMESTAMP>", "<REDACTED_BEARER_TOKEN>"],
      },
      request: {
        body: {},
        headers: {
          authorization: "<REDACTED_BEARER_TOKEN>",
        },
        method: "POST",
        path: `${PROXY_BASE_PATH}/logout`,
      },
      response: {
        body: response.body,
        headers: {
          "content-type": response.headers["content-type"],
        },
        status: response.status,
      },
      sideEffects: replaceDeep(
        {
          lollipopRevokeQueue: harness.readDecodedLollipopQueueMessages(),
          platformInternal: harness.platformInternalDeletes,
          redis: {
            lollipopAssertionRefStillExists:
              harness.redis.getStringValue(`KEYS-${SESSION_USER.fiscal_code}`) !==
              undefined,
            sessionStillExists:
              harness.redis.getStringValue(`SESSION-${SESSION_USER.session_token}`) !==
              undefined,
            userSessions: harness.redis.getSetMembers(
              `USERSESSIONS-${SESSION_USER.fiscal_code}`,
            ),
          },
          serviceBus: harness.serviceBusMessages,
        },
        {
          [String(
            (harness.serviceBusMessages[0]?.message as { body: { ts: number } })
              ?.body.ts ?? "",
          )]: "<LOGOUT_TIMESTAMP>",
          [SESSION_USER.session_token]: "<SESSION_TOKEN>",
        },
      ),
      topology: {
        boundary: "express app via supertest",
        dependencies: {
          lollipopRevokeQueue: "in-memory queue recorder",
          platformInternal: "in-memory client recorder",
          redis: "in-memory redis cluster fallback",
          serviceBus: "in-memory sender recorder",
        },
        workflow: "both/record-replay",
      },
    });
  });
});
