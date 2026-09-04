import { type NonEmptyString, ValidationError } from "@pagopa/hexagonal-core";
import { err, ok, type Result } from "neverthrow";

import {
  OidcConfigPort,
  OidcEnvConfig,
} from "../../domain/ports/outbound/oidc-config.port.js";
import { OidcConfigurationEnv } from "../../domain/value-objects/oidc.vo.js";

/**
 * Environment variables required to build the in-memory OIDC configuration.
 * UAT variables are optional: when missing, requests for the "UAT"
 * environment will be rejected with a `ValidationError`.
 */
export type InMemoryOidcConfigAdapterEnv = {
  ONEID_PROD_CLIENT_ID: NonEmptyString;
  ONEID_PROD_CLIENT_SECRET: NonEmptyString;
  ONEID_PROD_ISSUER: NonEmptyString;
  ONEID_PROD_REDIRECT_URI: NonEmptyString;
  ONEID_UAT_CLIENT_ID?: NonEmptyString;
  ONEID_UAT_CLIENT_SECRET?: NonEmptyString;
  ONEID_UAT_ISSUER?: NonEmptyString;
};

export class InMemoryOidcConfigAdapter implements OidcConfigPort {
  private readonly configByEnv: Partial<
    Record<OidcConfigurationEnv, OidcEnvConfig>
  >;

  constructor(env: InMemoryOidcConfigAdapterEnv) {
    const redirectUri = new URL(env.ONEID_PROD_REDIRECT_URI);

    this.configByEnv = {
      PROD: {
        clientId: env.ONEID_PROD_CLIENT_ID,
        clientSecret: env.ONEID_PROD_CLIENT_SECRET,
        baseUrl: new URL(env.ONEID_PROD_ISSUER),
        redirectUri,
      },
      ...(env.ONEID_UAT_CLIENT_ID &&
      env.ONEID_UAT_CLIENT_SECRET &&
      env.ONEID_UAT_ISSUER
        ? {
            UAT: {
              clientId: env.ONEID_UAT_CLIENT_ID,
              clientSecret: env.ONEID_UAT_CLIENT_SECRET,
              baseUrl: new URL(env.ONEID_UAT_ISSUER),
              redirectUri,
            },
          }
        : {}),
    };
  }

  getConfig(env: OidcConfigurationEnv): Result<OidcEnvConfig, ValidationError> {
    const config = this.configByEnv[env];
    if (!config) {
      return err(
        new ValidationError(
          `Missing OIDC configuration for environment "${env}"`,
        ),
      );
    }
    return ok(config);
  }
}
