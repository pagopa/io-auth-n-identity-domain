import { GenericError, NonEmptyString } from "@pagopa/hexagonal-core";
import { Result } from "neverthrow";
import { IdentityAssertion } from "../../value-objects/assertion.vo.js";
import { OidcEnvironment } from "../../value-objects/oidc.vo.js";

/**
 * Port interface for fetching SAML assertions from an external Resource Provider.
 */
export interface IdentityAssertionFetcherPort {
  /**
   * Fetches a SAML assertion from the specified environment using the provided access token.
   * @param env The environment from which to fetch the SAML assertion.
   * @param accessToken The access token to authenticate the request.
   * @returns A `Result` containing the SAML assertion as an `Assertion` if successful, or a `GenericError` if the request fails.
   */
  getAssertion(
    env: OidcEnvironment,
    accessToken: NonEmptyString,
  ): Promise<Result<IdentityAssertion, GenericError>>;
}
