import { ForbiddenError, GenericError } from "@pagopa/hexagonal-core";
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
  type ProfileLockCheck,
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
    { checks: [], userImposed: false, technical: false },
    { checks: ["user-set"], userImposed: true, technical: false },
    { checks: ["technical"], userImposed: false, technical: true },
    {
      checks: ["user-set", "technical"],
      userImposed: true,
      technical: true,
    },
    {
      checks: ["technical", "user-set"],
      userImposed: true,
      technical: true,
    },
    { checks: ["technical", "technical"], userImposed: false, technical: true },
  ] satisfies {
    checks: ProfileLockCheck[];
    userImposed: boolean;
    technical: boolean;
  }[])(
    "runs only the selected checks: $checks",
    async ({ checks, userImposed, technical }) => {
      const result = await validateProfileLocksUseCase({
        fiscalCode: aFiscalCode,
        checks,
      });

      expect(result).toEqual(ok(undefined));
      if (userImposed) {
        expect(mockIsLocked).toHaveBeenCalledExactlyOnceWith(aFiscalCode);
      } else {
        expect(mockIsLocked).not.toHaveBeenCalled();
      }
      if (technical) {
        expect(mockIsTechnicallyLocked).toHaveBeenCalledExactlyOnceWith(
          aFiscalCode,
        );
      } else {
        expect(mockIsTechnicallyLocked).not.toHaveBeenCalled();
      }
      expect(console.error).not.toHaveBeenCalled();
    },
  );

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
  ])("stops validation when $title", async ({ lockResult, expectedError }) => {
    mockIsLocked.mockResolvedValueOnce(lockResult);

    const result = await validateProfileLocksUseCase({
      fiscalCode: aFiscalCode,
      checks: ["user-set", "technical"],
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
    expect(mockIsTechnicallyLocked).toHaveBeenCalledExactlyOnceWith(
      aFiscalCode,
    );
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
  ])(
    "rejects validation when $title",
    async ({ lockResult, expectedError }) => {
      mockIsTechnicallyLocked.mockResolvedValueOnce(lockResult);

      const result = await validateProfileLocksUseCase({
        fiscalCode: aFiscalCode,
        checks: ["user-set", "technical"],
      });

      expect(result._unsafeUnwrapErr()).toEqual(expectedError);
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(
        expectedError.constructor,
      );
      if (lockResult.isOk()) {
        expect(result._unsafeUnwrapErr()).toBeInstanceOf(ForbiddenError);
        expect(result._unsafeUnwrapErr().tag).toBe("technical-profile-locked");
      } else {
        expect(result._unsafeUnwrapErr()).not.toBeInstanceOf(ForbiddenError);
      }
      expect(mockIsLocked).toHaveBeenCalledExactlyOnceWith(aFiscalCode);
      expect(mockIsTechnicallyLocked).toHaveBeenCalledExactlyOnceWith(
        aFiscalCode,
      );
      expect(console.error).not.toHaveBeenCalled();
    },
  );

  it.each([
    { title: "locked", lockResult: ok(true) },
    { title: "unavailable", lockResult: err(aGenericError) },
  ])(
    "skips the unselected user-set check even when it is $title",
    async ({ lockResult }) => {
      mockIsLocked.mockResolvedValueOnce(lockResult);

      const result = await validateProfileLocksUseCase({
        fiscalCode: aFiscalCode,
        checks: ["technical"],
      });

      expect(result).toEqual(ok(undefined));
      expect(mockIsLocked).not.toHaveBeenCalled();
      expect(mockIsTechnicallyLocked).toHaveBeenCalledExactlyOnceWith(
        aFiscalCode,
      );
      expect(console.error).not.toHaveBeenCalled();
    },
  );

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
  ])(
    "rejects technical-only validation when the technical lock is $title",
    async ({ lockResult, expectedError }) => {
      mockIsTechnicallyLocked.mockResolvedValueOnce(lockResult);

      const result = await validateProfileLocksUseCase({
        fiscalCode: aFiscalCode,
        checks: ["technical"],
      });

      expect(result._unsafeUnwrapErr()).toEqual(expectedError);
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(
        expectedError.constructor,
      );
      expect(mockIsLocked).not.toHaveBeenCalled();
      expect(mockIsTechnicallyLocked).toHaveBeenCalledExactlyOnceWith(
        aFiscalCode,
      );
      expect(console.error).not.toHaveBeenCalled();
    },
  );

  it.each([
    { title: "locked", lockResult: ok(true) },
    { title: "unavailable", lockResult: err(aGenericError) },
  ])(
    "skips the unselected technical check even when it is $title",
    async ({ lockResult }) => {
      mockIsTechnicallyLocked.mockResolvedValueOnce(lockResult);

      const result = await validateProfileLocksUseCase({
        fiscalCode: aFiscalCode,
        checks: ["user-set"],
      });

      expect(result).toEqual(ok(undefined));
      expect(mockIsLocked).toHaveBeenCalledExactlyOnceWith(aFiscalCode);
      expect(mockIsTechnicallyLocked).not.toHaveBeenCalled();
    },
  );

  it.each([
    {
      title: "locked",
      userResult: ok(true),
      technicalResult: ok(true),
      expectedError: new ProfileLockedError(),
    },
    {
      title: "unavailable",
      userResult: err(aGenericError),
      technicalResult: err(aGenericError),
      expectedError: new GenericError(
        `Error checking if profile is locked: ${aGenericError.message}`,
      ),
    },
  ])(
    "starts checks in parallel and prioritizes the user-set result when both are $title",
    async ({ userResult, technicalResult, expectedError }) => {
      let releaseUserCheck: (() => void) | undefined;
      mockIsLocked.mockReturnValueOnce(
        new Promise((resolve) => {
          releaseUserCheck = () => resolve(userResult);
        }),
      );
      mockIsTechnicallyLocked.mockResolvedValueOnce(technicalResult);

      const resultPromise = validateProfileLocksUseCase({
        fiscalCode: aFiscalCode,
        checks: ["technical", "user-set"],
      });

      try {
        expect(mockIsLocked).toHaveBeenCalledExactlyOnceWith(aFiscalCode);
        expect(mockIsTechnicallyLocked).toHaveBeenCalledExactlyOnceWith(
          aFiscalCode,
        );
      } finally {
        releaseUserCheck?.();
      }

      const result = await resultPromise;
      expect(result._unsafeUnwrapErr()).toEqual(expectedError);
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(
        expectedError.constructor,
      );
    },
  );
});
