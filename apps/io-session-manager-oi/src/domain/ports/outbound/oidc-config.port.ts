import {
  type NonEmptyString,
  type ValidationError,
} from "@pagopa/hexagonal-core";
import { Result } from "neverthrow";

import { OidcConfigurationEnv } from "../../value-objects/oidc.vo.js";

/**
 * Resolved OpenID Connect configuration for a single environment (PROD/UAT).
 *
 * `redirectUri` is the callback URL registered on the OIDC provider for
 * this application (shared across environments), while `baseUrl` is the
 * OIDC provider's issuer for the given environment.
 */
export type OidcEnvConfig = {
  clientId: NonEmptyString;
  clientSecret: NonEmptyString;
  baseUrl: URL;
  redirectUri: URL;
};

export interface OidcConfigPort {
  readonly getConfig: (
    env: OidcConfigurationEnv,
  ) => Result<OidcEnvConfig, ValidationError>;
}
