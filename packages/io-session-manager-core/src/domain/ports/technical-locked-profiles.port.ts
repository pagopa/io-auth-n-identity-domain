import { type BaseError, type FiscalCode } from "@pagopa/hexagonal-core";
import { type Result } from "neverthrow";

export interface TechnicalLockedProfilesPort {
  isLocked(
    fiscalCode: FiscalCode,
  ): Promise<Result<boolean, BaseError>>;
}
