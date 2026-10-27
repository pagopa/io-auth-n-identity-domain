import { ForbiddenError, GenericError } from "@pagopa/hexagonal-core";
import type { SpidLevel } from "@pagopa/io-auth-n-identity-session";
import { err, ok } from "neverthrow";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  aFiscalCode,
  aGenericError,
} from "../../../__mocks__/session.mocks.js";
import type { LockedProfilesPort } from "../../../domain/ports/outbound/locked-profiles.port.js";
import type { TechnicalLockedProfilesPort } from "../../../domain/ports/outbound/technical-locked-profiles.port.js";
import {
  makeValidateProfileLocksUseCase,
  ProfileLockedError,
  TechnicalProfileLockedError,
} from "../validate-profile-locks.use-case.js";

const mockIsLocked = vi.fn<LockedProfilesPort["isLocked"]>();
const mockIsTechnicallyLocked =
  vi.fn<TechnicalLockedProfilesPort["isLocked"]>();

const validateProfileLocksUseCase = makeValidateProfileLocksUseCase({
  lockedProfilesPort: {
    isLocked: mockIsLocked,
    healthcheck: vi.fn().mockResolvedValue(ok(undefined)),
  },
  technicalLockedProfilesPort: { isLocked: mockIsTechnicallyLocked },
});

beforeEach(() => {
  mockIsLocked.mockReset().mockResolvedValue(ok(false));
  mockIsTechnicallyLocked.mockReset().mockResolvedValue(ok(false));
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("makeValidateProfileLocksUseCase", () => {
  it.each([
    "https://www.spid.gov.it/SpidL1",
    "https://www.spid.gov.it/SpidL2",
  ] satisfies SpidLevel[])("checks both locks in order for %s", async (spidLevel) => {
    const result = await validateProfileLocksUseCase({
      fiscalCode: aFiscalCode,
      spidLevel,
    });

    expect(result).toEqual(ok(undefined));
    expect(mockIsLocked).toHaveBeenCalledExactlyOnceWith(aFiscalCode);
    expect(mockIsTechnicallyLocked).toHaveBeenCalledExactlyOnceWith(aFiscalCode);
    expect(mockIsLocked.mock.invocationCallOrder[0]).toBeLessThan(
      mockIsTechnicallyLocked.mock.invocationCallOrder[0],
    );
    expect(console.error).not.toHaveBeenCalled();
  });

  it.each([
    {
      title: "the profile is locked",
      lockResult: ok(true),
      expectedError: new ProfileLockedError(),
    },
    {
      title: "the profile lock check fails",
      lockResult: err(aGenericError),
      expectedError: new GenericError(
        `Error checking if profile is locked: ${aGenericError.message}`,
      ),
    },
  ])("stops validation when $title", async ({
    lockResult,
    expectedError,
  }) => {
    mockIsLocked.mockResolvedValueOnce(lockResult);

    const result = await validateProfileLocksUseCase({
      fiscalCode: aFiscalCode,
      spidLevel: "https://www.spid.gov.it/SpidL2",
    });

    expect(result._unsafeUnwrapErr()).toEqual(expectedError);
    expect(result._unsafeUnwrapErr()).toBeInstanceOf(expectedError.constructor);
    if (lockResult.isOk()) {
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(ForbiddenError);
      expect(result._unsafeUnwrapErr().tag).toBe("profile-locked");
    } else {
      expect(result._unsafeUnwrapErr()).not.toBeInstanceOf(ForbiddenError);
    }
    expect(mockIsLocked).toHaveBeenCalledExactlyOnceWith(aFiscalCode);
    expect(mockIsTechnicallyLocked).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  it.each([
    {
      title: "the profile is technically locked",
      lockResult: ok(true),
      expectedError: new TechnicalProfileLockedError(),
    },
    {
      title: "the technical lock check fails",
      lockResult: err(aGenericError),
      expectedError: new GenericError(
        `Error checking if profile is technically locked: ${aGenericError.message}`,
      ),
    },
  ])("rejects validation when $title", async ({ lockResult, expectedError }) => {
    mockIsTechnicallyLocked.mockResolvedValueOnce(lockResult);

    const result = await validateProfileLocksUseCase({
      fiscalCode: aFiscalCode,
      spidLevel: "https://www.spid.gov.it/SpidL2",
    });

    expect(result._unsafeUnwrapErr()).toEqual(expectedError);
    expect(result._unsafeUnwrapErr()).toBeInstanceOf(expectedError.constructor);
    if (lockResult.isOk()) {
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(ForbiddenError);
      expect(result._unsafeUnwrapErr().tag).toBe("technical-profile-locked");
    } else {
      expect(result._unsafeUnwrapErr()).not.toBeInstanceOf(ForbiddenError);
    }
    expect(mockIsLocked).toHaveBeenCalledExactlyOnceWith(aFiscalCode);
    expect(mockIsTechnicallyLocked).toHaveBeenCalledExactlyOnceWith(aFiscalCode);
    expect(console.error).not.toHaveBeenCalled();
  });

  it.each([
    { title: "locked", lockResult: ok(true) },
    { title: "unavailable", lockResult: err(aGenericError) },
  ])("skips the regular profile lock check at L3 even when it is $title", async ({ lockResult }) => {
    mockIsLocked.mockResolvedValueOnce(lockResult);

    const result = await validateProfileLocksUseCase({
      fiscalCode: aFiscalCode,
      spidLevel: "https://www.spid.gov.it/SpidL3",
    });

    expect(result).toEqual(ok(undefined));
    expect(mockIsLocked).not.toHaveBeenCalled();
    expect(mockIsTechnicallyLocked).toHaveBeenCalledExactlyOnceWith(aFiscalCode);
    expect(console.error).not.toHaveBeenCalled();
  });

  it.each([
    {
      title: "locked",
      lockResult: ok(true),
      expectedError: new TechnicalProfileLockedError(),
    },
    {
      title: "unavailable",
      lockResult: err(aGenericError),
      expectedError: new GenericError(
        `Error checking if profile is technically locked: ${aGenericError.message}`,
      ),
    },
  ])("still rejects L3 when the technical lock is $title", async ({ lockResult, expectedError }) => {
    mockIsTechnicallyLocked.mockResolvedValueOnce(lockResult);

    const result = await validateProfileLocksUseCase({
      fiscalCode: aFiscalCode,
      spidLevel: "https://www.spid.gov.it/SpidL3",
    });

    expect(result._unsafeUnwrapErr()).toEqual(expectedError);
    expect(result._unsafeUnwrapErr()).toBeInstanceOf(expectedError.constructor);
    expect(mockIsLocked).not.toHaveBeenCalled();
    expect(mockIsTechnicallyLocked).toHaveBeenCalledExactlyOnceWith(aFiscalCode);
    expect(console.error).not.toHaveBeenCalled();
  });
});
