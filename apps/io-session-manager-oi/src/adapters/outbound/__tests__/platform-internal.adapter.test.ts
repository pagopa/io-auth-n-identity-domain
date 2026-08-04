import { GenericError } from "@pagopa/hexagonal-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createPlatformInternalAdapter } from "../platform-internal.adapter.js";
import { deleteSession } from "../../../generated/platform-internal/sdk.gen.js";
import { HashedClientSessionToken } from "../../../domain/value-objects/client-session-token.vo.js";

vi.mock("../../../generated/platform-internal/client/index.js", () => ({
  createClient: vi.fn(() => ({
    interceptors: { request: { use: vi.fn() } },
  })),
}));

vi.mock("../../../generated/platform-internal/sdk.gen.js", () => ({
  deleteSession: vi.fn(),
}));

const SESSION_TOKEN = "a".repeat(64) as HashedClientSessionToken;

const adapter = createPlatformInternalAdapter({
  baseUrl: "http://localhost",
  apiKey: "test-key",
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createPlatformInternalAdapter#deleteSession", () => {
  it("returns ok(undefined) on 204", async () => {
    vi.mocked(deleteSession).mockResolvedValue({
      data: undefined,
      error: undefined,
      response: { status: 204 } as Response,
    });

    const result = await adapter.deleteSession(SESSION_TOKEN);

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toBeUndefined();
  });

  it.each([400, 401, 429, 500])(
    "returns err(GenericError) on %i",
    async (status) => {
      vi.mocked(deleteSession).mockResolvedValue({
        data: undefined,
        error: {},
        response: { status } as Response,
      });

      const result = await adapter.deleteSession(SESSION_TOKEN);

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(GenericError);
    },
  );
});
