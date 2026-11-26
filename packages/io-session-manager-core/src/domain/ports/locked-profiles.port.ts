import { type BaseError, type FiscalCode } from "@pagopa/hexagonal-core";
import { HealthCheckOutboundPort } from "@pagopa/io-auth-n-identity-domain";
import { type Result } from "neverthrow";

import { UnlockCode } from "../index.js";

export interface LockedProfilesPort extends HealthCheckOutboundPort {
  /**
   * Checks if the profile for the given fiscal code is locked.
   *
   * @param fiscalCode The fiscal code of the profile to check.
   * @returns A `Result` indicating whether the profile is locked or not, or an error with a `BaseError`.
   */
  isLocked(fiscalCode: FiscalCode): Promise<Result<boolean, BaseError>>;

  /**
   * Locks the profile for a given fiscal code with the provided unlock code.
   *
   * @param fiscalCode The fiscal code of the profile to lock.
   * @param unlockCode The unlock code corresponding to the lock to create.
   * @returns A `Result` indicating success or failure with a `BaseError`.
   */
  lock(
    fiscalCode: FiscalCode,
    unlockCode: UnlockCode,
  ): Promise<Result<void, BaseError>>;

  /**
   * Releases the unreleased locks for a given fiscal code; released locks are kept.
   * If no unreleased locks exist, it succeeds.
   * If `unlockCode` is provided, only the matching unreleased lock is released;
   * when it does not match any of them, it fails with a `ForbiddenError`.
   * If `unlockCode` is omitted, all the unreleased locks are released.
   *
   * @param fiscalCode The fiscal code of the profile to unlock.
   * @param unlockCode The unlock code corresponding to the lock to release. If omitted, all the unreleased locks are released.
   * @returns A `Result` indicating success or failure with a `BaseError`.
   */
  unlock(
    fiscalCode: FiscalCode,
    unlockCode?: UnlockCode,
  ): Promise<Result<void, BaseError>>;
}
