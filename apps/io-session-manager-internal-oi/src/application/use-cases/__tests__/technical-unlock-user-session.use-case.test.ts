import { FiscalCodeSchema, GenericError } from "@pagopa/hexagonal-core";
import type { TechnicalLockedProfilesPort } from "@pagopa/io-session-manager-core";
import { err, ok } from "neverthrow";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { makeTechnicalUnlockUserSessionUseCase } from "../technical-unlock-user-session.use-case.js";

const fiscalCode = FiscalCodeSchema.parse("ISPXNB32R82Y766D");
const unlock = vi.fn<TechnicalLockedProfilesPort["unlock"]>();
const unlockUserSession = makeTechnicalUnlockUserSessionUseCase({
  isLocked: vi.fn<TechnicalLockedProfilesPort["isLocked"]>(),
  lock: vi.fn<TechnicalLockedProfilesPort["lock"]>(),
  unlock,
});

beforeEach(() => {
  unlock.mockReset().mockResolvedValue(ok(undefined));
});

describe("makeTechnicalUnlockUserSessionUseCase", () => {
  it("unlocks the profile", async () => {
    expect(await unlockUserSession({ fiscalCode })).toEqual(ok(undefined));
    expect(unlock).toHaveBeenCalledExactlyOnceWith(fiscalCode);
  });

  it("converts a technical profile unlock failure to a generic error", async () => {
    const storageError = new GenericError("table unavailable");
    unlock.mockResolvedValueOnce(err(storageError));

    expect(await unlockUserSession({ fiscalCode })).toEqual(
      err(
        new GenericError(
          `Failed to unlock technical profile: ${storageError.message}`,
        ),
      ),
    );
  });
});
