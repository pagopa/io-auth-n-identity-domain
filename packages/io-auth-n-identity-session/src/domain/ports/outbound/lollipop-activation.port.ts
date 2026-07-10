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
export interface ILollipopActivationPort {
  readonly getByFiscalCode: (
    fiscalCode: FiscalCode,
  ) => Promise<Result<LollipopActivation, GenericError | NotFoundError>>;

  readonly activate: (
    activation: LollipopActivation,
  ) => Promise<Result<void, GenericError | ConflictError>>;

  readonly revokeByFiscalCode: (
    fiscalCode: FiscalCode,
  ) => Promise<Result<void, GenericError | NotFoundError>>;
}
