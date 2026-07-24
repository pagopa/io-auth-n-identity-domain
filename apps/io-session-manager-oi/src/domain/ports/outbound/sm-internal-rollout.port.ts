import {
  type FiscalCode,
  type GenericError,
  type NotFoundError,
} from "@pagopa/hexagonal-core";
import { type Result } from "neverthrow";

import { LollipopAssertionRef } from "@pagopa/io-auth-n-identity-domain";

/**
 * Port exposing the io-session-manager-internal endpoints used to support
 * the new session data model rollout plan.
 */
export interface SmInternalRolloutPort {
  /**
   * Delete user session and invalidate lollipop activation, without
   * revoking the pubkey.
   */
  readonly softDeleteUserSession: (
    fiscalCode: FiscalCode,
  ) => Promise<Result<undefined, GenericError>>;

  /**
   * Get the user Lollipop activation.
   */
  readonly getUserLollipopActivation: (
    fiscalCode: FiscalCode,
  ) => Promise<Result<LollipopAssertionRef, GenericError | NotFoundError>>;
}
