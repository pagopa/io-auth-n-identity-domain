import type { BaseError, FiscalCode } from "@pagopa/hexagonal-core";
import type { HealthCheckOutboundPort } from "@pagopa/io-auth-n-identity-domain";
import type { Result } from "neverthrow";

export type UnlockCode = string & { readonly UnlockCode: unique symbol };

export type NotReleasedAuthenticationLockData = {
  partitionKey: FiscalCode;
  rowKey: UnlockCode;
  CreatedAt: Date;
};

export interface AuthLockPort extends HealthCheckOutboundPort {
  getUserAuthenticationLocks(
    fiscalCode: FiscalCode,
  ): Promise<Result<ReadonlyArray<NotReleasedAuthenticationLockData>, BaseError>>;
  isUserAuthenticationLocked(
    fiscalCode: FiscalCode,
  ): Promise<Result<boolean, BaseError>>;
  lockUserAuthentication(
    fiscalCode: FiscalCode,
    unlockCode: UnlockCode,
  ): Promise<Result<true, BaseError>>;
  unlockUserAuthentication(
    fiscalCode: FiscalCode,
    unlockCodes: ReadonlyArray<UnlockCode>,
  ): Promise<Result<true, BaseError>>;
}
