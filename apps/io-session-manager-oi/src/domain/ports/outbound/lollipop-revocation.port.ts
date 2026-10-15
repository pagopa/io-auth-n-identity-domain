import type { GenericError } from "@pagopa/hexagonal-core";
import type { LollipopAssertionRef } from "@pagopa/io-auth-n-identity-domain";
import type { Result } from "neverthrow";

export interface LollipopRevocationPort {
  /**
   * Requests the revocation of a Lollipop assertion.
   * @param assertionRef The reference to the Lollipop assertion to be revoked.
   * @returns A Result indicating the success or failure of the revocation request.
   */
  readonly requestRevocation: (
    assertionRef: LollipopAssertionRef,
  ) => Promise<Result<void, GenericError>>;
}
