import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { PROXY_BASE_PATH } from "../support/fixtures";
import { createBackendTestHarness } from "../support/runtime";
import { getCurrentBackendVersion } from "../../utils/package";

describe("backend integration | healthcheck", () => {
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

  it("returns the backend version through the real express app", async () => {
    const response = await harness.http.get(`${PROXY_BASE_PATH}/healthcheck`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      version: getCurrentBackendVersion(),
    });
  });
});
