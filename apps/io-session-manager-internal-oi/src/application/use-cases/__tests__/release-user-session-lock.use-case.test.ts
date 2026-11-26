import {
  FiscalCodeSchema,
  ForbiddenError,
  GenericError,
} from "@pagopa/hexagonal-core";
import type { LockedProfilesPort } from "@pagopa/io-session-manager-core";
import { UnlockCodeSchema } from "@pagopa/io-session-manager-core";
import { err, ok } from "neverthrow";
import { describe, expect, it, vi } from "vitest";

import { makeReleaseUserSessionLockUseCase } from "../release-user-session-lock.use-case.js";

const fiscalCode = FiscalCodeSchema.parse("ISPXNB32R82Y766D");
const unlockCode = UnlockCodeSchema.parse("012345678");
const unlock = vi.fn<LockedProfilesPort["unlock"]>();
const useCase = makeReleaseUserSessionLockUseCase({
  unlock,
  isLocked: vi.fn(),
  lock: vi.fn(),
  healthcheck: vi.fn(),
});

describe("makeReleaseUserSessionLockUseCase", () => {
  it("forwards the fiscal code and the optional unlock code", async () => {
    unlock.mockResolvedValue(ok(undefined));

    expect(await useCase({ fiscalCode, unlockCode })).toEqual(ok(undefined));
    expect(unlock).toHaveBeenLastCalledWith(fiscalCode, unlockCode);

    await useCase({ fiscalCode });
    expect(unlock).toHaveBeenLastCalledWith(fiscalCode, undefined);
  });

  it("preserves the forbidden error", async () => {
    const error = new ForbiddenError();
    unlock.mockResolvedValueOnce(err(error));

    expect(await useCase({ fiscalCode, unlockCode })).toEqual(err(error));
  });

  it("maps any other failure to a generic error", async () => {
    unlock.mockResolvedValueOnce(err(new GenericError("table down")));

    const result = await useCase({ fiscalCode, unlockCode });

    expect(result._unsafeUnwrapErr()).toBeInstanceOf(GenericError);
  });
});
