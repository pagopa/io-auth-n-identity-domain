import { beforeEach, describe, it, vi, expect } from "vitest";
import * as t from "io-ts";
import { PlatformInternalRepository } from "../platform-internal";
import { mockSessionToken } from "../../__mocks__/user.mock";
import * as E from "fp-ts/lib/Either";
import {
  mockDeleteSession,
  mockPlatformInternalClient,
} from "../../__mocks__/platform-internal-client.mock";
import * as appinsights from "../../utils/appinsights";
import { Errors } from "io-ts";

const trackEventMock = vi.spyOn(appinsights, "trackEvent");

describe("PlatformInternal repository#cacheDelSessionToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockedDependencies = {
    platformInternalApiClient: mockPlatformInternalClient,
    sessionToken: mockSessionToken,
  };
  const expectedError = Error("Error while calling internal proxy");

  it("should clear the session token in cache", async () => {
    const result =
      await PlatformInternalRepository.cacheDelSessionToken(
        mockedDependencies,
      )();

    expect(result).toEqual(E.right(true));
    expect(mockDeleteSession).toHaveBeenCalledTimes(1);
    expect(mockDeleteSession).toHaveBeenNthCalledWith(1, {
      "X-Session-Token": mockSessionToken,
    });
    expect(trackEventMock).toHaveBeenCalledTimes(0);
  });

  it("should error on network failure and track event", async () => {
    const trackError = Error("error");
    mockDeleteSession.mockRejectedValueOnce(trackError);
    const result =
      await PlatformInternalRepository.cacheDelSessionToken(
        mockedDependencies,
      )();

    expect(result).toEqual(E.left(expectedError));
    expect(mockDeleteSession).toHaveBeenCalledTimes(1);
    expect(trackEventMock).toHaveBeenCalledTimes(1);
    expect(trackEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "session.cachedel.error",
        properties: {
          errorMessage: trackError.message,
        },
      }),
    );
  });

  it("should error on decode error and track event", async () => {
    // simulating decodingerror
    const decodingError = (t.string.decode(null) as E.Left<Errors>).left;
    mockDeleteSession.mockResolvedValueOnce(E.left(decodingError));
    const result =
      await PlatformInternalRepository.cacheDelSessionToken(
        mockedDependencies,
      )();

    expect(result).toEqual(E.left(expectedError));
    expect(mockDeleteSession).toHaveBeenCalledTimes(1);
    expect(trackEventMock).toHaveBeenCalledTimes(1);
    expect(trackEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "session.cachedel.error",
        properties: {
          errorMessage: expect.stringContaining(
            "Error while decoding deleteSession response:",
          ),
        },
      }),
    );
  });

  it("should error on unrecognized status and track event", async () => {
    mockDeleteSession.mockResolvedValueOnce(E.right({ status: 999 }));
    const result =
      await PlatformInternalRepository.cacheDelSessionToken(
        mockedDependencies,
      )();

    expect(result).toEqual(E.left(expectedError));
    expect(mockDeleteSession).toHaveBeenCalledTimes(1);
    expect(trackEventMock).toHaveBeenCalledTimes(1);
    expect(trackEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "session.cachedel.error",
        properties: {
          errorMessage: expect.stringContaining(
            "Error while calling deleteSession API",
          ),
        },
      }),
    );
  });
});
