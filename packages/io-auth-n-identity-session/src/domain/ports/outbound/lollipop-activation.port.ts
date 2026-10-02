import {
  ConflictError,
  FiscalCode,
  GenericError,
  NotFoundError,
} from "@pagopa/hexagonal-core";
import type { Result } from "neverthrow";

import { LollipopActivation } from "../../entities/lollipop-activation.entity.js";

/**
 * Outbound port for handling Lollipop activations.
 */
export interface LollipopActivationPort {
  readonly getByFiscalCode: (
    fiscalCode: FiscalCode,
  ) => Promise<Result<LollipopActivation, GenericError | NotFoundError>>;

  readonly activate: (
    activation: LollipopActivation,
  ) => Promise<Result<void, GenericError | ConflictError>>;

  /**
   * Upserts a lollipop activation into the underlying storage. If the activation already exists, it will be updated; otherwise, a new record will be created.
   * @param activation  The lollipop activation entity to upsert into the database.
   * @returns A `Result` indicating the success or failure of the upsert operation.
   */
  readonly upsert: (
    activation: LollipopActivation,
  ) => Promise<Result<void, GenericError | ConflictError>>;

  readonly revokeByFiscalCode: (
    fiscalCode: FiscalCode,
  ) => Promise<Result<void, GenericError>>;
}
