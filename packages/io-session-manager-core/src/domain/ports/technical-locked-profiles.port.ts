import { type BaseError, type FiscalCode } from "@pagopa/hexagonal-core";
import { type Result } from "neverthrow";

export interface TechnicalLockedProfilesPort {
  isLocked(
    fiscalCode: FiscalCode,
  ): Promise<Result<boolean, BaseError>>;

  lock(
    fiscalCode: FiscalCode,
  ): Promise<Result<void, BaseError>>;

  unlock(
    fiscalCode: FiscalCode,
  ): Promise<Result<void, BaseError>>;
}
