import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  ASSERTION_REF,
  FISCAL_CODE,
  LOLLIPOP_HEADERS,
  PREVIOUS_SESSION_USER,
  PROXY_BASE_PATH,
} from "../support/fixtures";
import { recordOrVerifyScenario, replaceDeep } from "../support/record-replay";
import { createBackendTestHarness } from "../support/runtime";

describe("backend record-replay | fast-login", () => {
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

  it("freezes the fast-login happy path", async () => {
    await harness.redis.seedUserSession(PREVIOUS_SESSION_USER, 3600);
    await harness.redis.seedLollipopAssertionRef(FISCAL_CODE, ASSERTION_REF, 3600);

    const response = await harness.http
      .post(`${PROXY_BASE_PATH}/fast-login`)
      .set(LOLLIPOP_HEADERS)
      .send({});

    expect(response.status, JSON.stringify(response.body)).toBe(200);
    expect(response.body.token).toEqual(expect.any(String));

    const persistedUser = harness.redis.getJsonValue(
      `SESSION-${String(response.body.token)}`,
    ) as Record<string, string | number>;
    const operationId = String(
      (
        harness.stubServer.getState().lollipopGenerateRequests[0]?.body as {
          readonly operation_id?: string;
        }
      )?.operation_id,
    );
    const replacements = {
      [String(persistedUser.bpd_token)]: "<BPD_TOKEN>",
      [String(persistedUser.created_at)]: "<CREATED_AT>",
      [String(persistedUser.fims_token)]: "<FIMS_TOKEN>",
      [String(persistedUser.myportal_token)]: "<MYPORTAL_TOKEN>",
      [String(persistedUser.session_token)]: "<SESSION_TOKEN>",
      [String(persistedUser.session_tracking_id)]: "<SESSION_TRACKING_ID>",
      [String(persistedUser.wallet_token)]: "<WALLET_TOKEN>",
      [String(persistedUser.zendesk_token)]: "<ZENDESK_TOKEN>",
      [operationId]: "<OPERATION_ID>",
      [PREVIOUS_SESSION_USER.session_token]: "<PREVIOUS_SESSION_TOKEN>",
      [response.body.token as string]: "<SESSION_TOKEN>",
    };

    await recordOrVerifyScenario("fast-login-happy-path", {
      normalization: {
        dynamicFields: [
          "response.body.token",
          "sideEffects.lollipopGenerateStub[0].body.operation_id",
          "sideEffects.redis.createdUser.*token",
          "sideEffects.redis.createdUser.session_tracking_id",
          "sideEffects.redis.createdUser.created_at",
          "sideEffects.platformInternal.deleteSession[0].headers.x-session-token",
        ],
        placeholders: Object.values(replacements),
      },
      request: {
        body: {},
        headers: LOLLIPOP_HEADERS,
        method: "POST",
        path: `${PROXY_BASE_PATH}/fast-login`,
      },
      response: replaceDeep(
        {
          body: response.body,
          headers: {
            "content-type": response.headers["content-type"],
          },
          status: response.status,
        },
        replacements,
      ),
      sideEffects: replaceDeep(
        {
          fastLoginStub: harness.stubServer.getState().fastLoginRequests,
          lollipopGenerateStub: harness.stubServer.getState().lollipopGenerateRequests,
          platformInternal: {
            deleteSession: harness.platformInternalDeletes,
          },
          redis: {
            createdSessionInfoTtlSeconds: await harness.redis.getTtlSeconds(
              `SESSIONINFO-${String(response.body.token)}`,
            ),
            createdUser: persistedUser,
            currentUserSessions: harness.redis.getSetMembers(
              `USERSESSIONS-${FISCAL_CODE}`,
            ),
            previousSessionStillExists:
              harness.redis.getStringValue(
                `SESSION-${PREVIOUS_SESSION_USER.session_token}`,
              ) !== undefined,
          },
        },
        replacements,
      ),
      topology: {
        boundary: "express app via supertest",
        dependencies: {
          lollipop: "local HTTP stub",
          platformInternal: "in-memory client recorder",
          redis: "in-memory redis cluster fallback",
          serviceBus: "in-memory sender recorder",
        },
        workflow: "both/record-replay",
      },
    });
  });
});
