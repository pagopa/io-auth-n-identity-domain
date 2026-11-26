import {
  type FiscalCode,
  ForbiddenError,
  GenericError,
  type UseCase,
} from "@pagopa/hexagonal-core";
import type {
  LockedProfilesPort,
  UnlockCode,
} from "@pagopa/io-session-manager-core";
import { err, ok } from "neverthrow";

type ReleaseUserSessionLockInput = {
  fiscalCode: FiscalCode;
  unlockCode?: UnlockCode;
};

export type ReleaseUserSessionLockUseCase = UseCase<
  ReleaseUserSessionLockInput,
  void,
  ForbiddenError | GenericError
>;

export const makeReleaseUserSessionLockUseCase =
  (lockedProfilesPort: LockedProfilesPort): ReleaseUserSessionLockUseCase =>
  async ({ fiscalCode, unlockCode }) => {
    const result = await lockedProfilesPort.unlock(fiscalCode, unlockCode);
    if (result.isOk()) {
      return ok(undefined);
    }
    return err(
      result.error instanceof ForbiddenError
        ? result.error
        : new GenericError(
            `Failed to release user session lock: ${result.error.message}`,
          ),
    );
  };
