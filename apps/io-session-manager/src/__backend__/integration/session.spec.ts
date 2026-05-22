import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  ASSERTION_REF,
  PROXY_BASE_PATH,
  SESSION_USER,
} from "../support/fixtures";
import { createBackendTestHarness } from "../support/runtime";

describe("backend integration | session", () => {
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

  it("returns the live session state with bearer auth and profile lookup", async () => {
    await harness.redis.seedUserSession(SESSION_USER, 3600);
    await harness.redis.seedLollipopAssertionRef(
      SESSION_USER.fiscal_code,
      ASSERTION_REF,
      3600,
    );

    const response = await harness.http
      .get(`${PROXY_BASE_PATH}/session`)
      .set("Authorization", `Bearer ${SESSION_USER.session_token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      bpdToken: SESSION_USER.bpd_token,
      expirationDate: expect.any(String),
      fimsToken: SESSION_USER.fims_token,
      lollipopAssertionRef: ASSERTION_REF,
      myPortalToken: SESSION_USER.myportal_token,
      spidLevel: SESSION_USER.spid_level,
      walletToken: SESSION_USER.wallet_token,
      zendeskToken: expect.stringMatching(
        new RegExp(`^${SESSION_USER.zendesk_token}[0-9a-f]{8}$`),
      ),
    });
    expect(harness.stubServer.getState().profileRequests).toEqual([
      {
        body: {},
        headers: {},
        method: "GET",
        path: `/api/v1/profiles/${SESSION_USER.fiscal_code}`,
      },
    ]);
  });
});
