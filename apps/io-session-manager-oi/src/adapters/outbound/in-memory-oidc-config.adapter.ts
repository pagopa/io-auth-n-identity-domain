import { ValidationError } from "@pagopa/hexagonal-core";
import { err, ok, type Result } from "neverthrow";

import {
  OidcConfig,
  OidcConfigPort,
} from "../../domain/ports/outbound/oidc-config.port.js";
import { OneIdConfig } from "../../domain/value-objects/configs/one-id.vo.js";
import { OidcEnvironment } from "../../domain/value-objects/oidc.vo.js";

export class InMemoryOidcConfigAdapter implements OidcConfigPort {
  private readonly configByEnv: Partial<Record<OidcEnvironment, OidcConfig>>;

  constructor(env: OneIdConfig) {
    const redirectUri = env.ONEID_PROD_REDIRECT_URI;

    this.configByEnv = {
      PROD: {
        clientId: env.ONEID_PROD_CLIENT_ID,
        clientSecret: env.ONEID_PROD_CLIENT_SECRET,
        baseUrl: env.ONEID_PROD_ISSUER,
        redirectUri,
      },
      ...(env.ONEID_UAT_CLIENT_ID &&
      env.ONEID_UAT_CLIENT_SECRET &&
      env.ONEID_UAT_ISSUER
        ? {
            UAT: {
              clientId: env.ONEID_UAT_CLIENT_ID,
              clientSecret: env.ONEID_UAT_CLIENT_SECRET,
              baseUrl: env.ONEID_UAT_ISSUER,
              redirectUri,
            },
          }
        : {}),
    };
  }

  getConfig(env: OidcEnvironment): Result<OidcConfig, ValidationError> {
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
