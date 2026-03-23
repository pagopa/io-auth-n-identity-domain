import { describe, test, expect, vi, afterEach } from "vitest";
import * as E from "fp-ts/Either";
import * as t from "io-ts";

import {
  mockTrackEvent,
  mockedAppinsightsTelemetryClient,
} from "../../__mocks__/appinsights.mocks";
import { mockSessionToken } from "../../__mocks__/user.mocks";
import {
  CACHEDEL_PROXY_ERROR_EVENT_NAME,
  cacheDelSessionToken,
} from "../platform-internal";
import {
  mockDeleteSession,
  mockedPlatformInternalAPIClient,
} from "../../__mocks__/repositories/platform-internal-client.mocks";

const mockedDeps = {
  platformInternalAPIClient: mockedPlatformInternalAPIClient,
  appInsightsTelemetryClient: mockedAppinsightsTelemetryClient,
  sessionToken: mockSessionToken,
};

describe("PlatformInternalService#cacheDelSessionToken", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });
  const genericError = new Error("Error while calling internal proxy");

  test("should return true when deleteSession responds with status 204", async () => {
    const result = await cacheDelSessionToken(mockedDeps)();

    expect(result).toEqual(E.right(true));
    expect(mockDeleteSession).toHaveBeenCalledTimes(1);
    expect(mockDeleteSession).toHaveBeenCalledWith({
      "X-Session-Token": mockSessionToken,
    });
    expect(mockTrackEvent).not.toHaveBeenCalled();
  });

  test.each`
    scenario        | status
    ${"status 400"} | ${400}
    ${"status 401"} | ${401}
    ${"status 429"} | ${429}
    ${"status 500"} | ${500}
  `(
    "should return a generic error when deleteSession responds with $scenario",
    async ({ status }) => {
      mockDeleteSession.mockResolvedValueOnce(
        E.right({ status, value: undefined }),
      );

      const result = await cacheDelSessionToken(mockedDeps)();

      expect(result).toEqual(E.left(genericError));
      expect(mockDeleteSession).toHaveBeenCalledTimes(1);
      expect(mockTrackEvent).toHaveBeenCalledTimes(1);
      expect(mockTrackEvent).toHaveBeenCalledWith({
        name: CACHEDEL_PROXY_ERROR_EVENT_NAME,
        properties: {
          errorMessage: `Error while calling deleteSession API: status ${status}`,
        },
      });
    },
  );

  test("should return a generic error when deleteSession throws a network error", async () => {
    const networkError = new Error("network error");
    mockDeleteSession.mockRejectedValueOnce(networkError);

    const result = await cacheDelSessionToken(mockedDeps)();

    expect(result).toEqual(E.left(genericError));
    expect(mockDeleteSession).toHaveBeenCalledTimes(1);
    expect(mockTrackEvent).toHaveBeenCalledTimes(1);
    expect(mockTrackEvent).toHaveBeenCalledWith({
      name: CACHEDEL_PROXY_ERROR_EVENT_NAME,
      properties: {
        errorMessage: networkError.message,
      },
    });
  });

  test("should return a generic error when deleteSession returns a decode error", async () => {
    mockDeleteSession.mockResolvedValueOnce(t.string.decode(1));

    const result = await cacheDelSessionToken(mockedDeps)();

    expect(result).toEqual(E.left(genericError));
    expect(mockTrackEvent).toHaveBeenCalledOnce();
    expect(mockTrackEvent).toHaveBeenCalledWith({
      name: CACHEDEL_PROXY_ERROR_EVENT_NAME,
      properties: {
        errorMessage: expect.stringContaining(
          "Error while decoding deleteSession response",
        ),
      },
    });
  });
});
