import { randomBytes } from "node:crypto";

import {
  GenericError,
  type NonEmptyString,
  type UseCase,
  ValidationError,
} from "@pagopa/hexagonal-core";
import type { Logger } from "@pagopa/hexagonal-core/domain/ports";
import { type IPString } from "@pagopa/io-auth-n-identity-domain";
import { err, ok } from "neverthrow";

import { type AuxiliaryDataPort } from "../../domain/ports/outbound/auxiliary-data.port.js";
import { type OidcConfigPort } from "../../domain/ports/outbound/oidc-config.port.js";
import { type OidcClientPort } from "../../domain/ports/outbound/oidc.port.js";
import {
  type Idp,
  type SpidAuthLevel,
  type SpidLevel,
} from "../../domain/value-objects/login.vo.js";
import { type OidcEnvironment } from "../../domain/value-objects/oidc.vo.js";
import { sha256 } from "../../utils/crypto/hash.js";
import { toFullyQualifiedSpidLevel } from "../../utils/spid.js";

type StartLoginDeps = {
  auxiliaryDataPort: AuxiliaryDataPort;
  oidcClientPort: OidcClientPort;
  oidcConfigPort: OidcConfigPort;
  logger: Pick<Logger, "trackEvent">;
};

export type StartLoginInput = {
  oidcConfigurationEnv: OidcEnvironment;
  minAuthLevel: SpidAuthLevel;
  idp: Idp;
  ipAddress: IPString;
};

/** Parameters needed to build the OneIdentity authorization request. */
export type StartLoginOutput = {
  authorizationEndpoint: URL;
  clientId: NonEmptyString;
  redirectUri: URL;
  scope: "openid";
  state: NonEmptyString;
  nonce: NonEmptyString;
  responseType: "code";
  acrValues: SpidLevel;
  idp: Idp;
};

/**
 * Starts the OIDC authorization code flow towards OneIdentity: generates the
 * `state`/`nonce` pair, stores the auxiliary data needed by the callback and
 * returns the authorization request parameters.
 *
 * Every outcome emits an unsampled diagnostic event to correlate the login
 * flow with OneIdentity. It must never carry personal data, authorization
 * codes or tokens: the client IP is only tracked as its SHA-256 hash.
 */
export const makeStartLoginUseCase =
  (
    deps: StartLoginDeps,
  ): UseCase<
    StartLoginInput,
    StartLoginOutput,
    GenericError | ValidationError
  > =>
  async (input) => {
    const commonEventProperties = {
      samplingEnabled: false,
      ipHash: sha256(input.ipAddress),
      env: input.oidcConfigurationEnv,
      idp: input.idp,
      minAuthLevel: input.minAuthLevel,
    };

    const oidcConfigResult = deps.oidcConfigPort.getConfig(
      input.oidcConfigurationEnv,
    );
    if (oidcConfigResult.isErr()) {
      deps.logger.trackEvent({
        name: "ioweb-auth.oidc.login.config.error",
        properties: {
          ...commonEventProperties,
          failureReason: "environment_not_configured",
        },
      });
      return err(oidcConfigResult.error);
    }
    const { clientId, redirectUri } = oidcConfigResult.value;
    const state = randomBytes(24).toString("hex") as NonEmptyString;
    const nonce = randomBytes(24).toString("hex") as NonEmptyString;

    const authorizationEndpointResult =
      await deps.oidcClientPort.getAuthorizationEndpoint(
        input.oidcConfigurationEnv,
      );
    if (authorizationEndpointResult.isErr()) {
      const error = authorizationEndpointResult.error;
      const { reason } = error;
      deps.logger.trackEvent({
        name:
          reason === "discovery_failed"
            ? "ioweb-auth.oidc.login.discovery.error"
            : "ioweb-auth.oidc.login.auth-decode.error",
        properties: {
          ...commonEventProperties,
          failureReason: reason,
          state,
          nonce,
        },
      });
      return err(error);
    }

    const saveResult = await deps.auxiliaryDataPort.save(state, {
      clientId,
      minAuthLevel: input.minAuthLevel,
      oidcConfigurationEnv: input.oidcConfigurationEnv,
      nonce,
    });
    if (saveResult.isErr()) {
      const error = new GenericError(
        `Could not save auxiliary data, caused by: ${saveResult.error.message}`,
      );
      deps.logger.trackEvent({
        name: "ioweb-auth.oidc.login.auxiliary-data.error",
        properties: {
          ...commonEventProperties,
          failureReason: "auxiliary_data_save_failed",
          state,
          nonce,
        },
      });
      return err(error);
    }

    deps.logger.trackEvent({
      name: "ioweb-auth.oidc.login.success.info",
      properties: {
        ...commonEventProperties,
        state,
        nonce,
        clientId,
      },
    });

    return ok({
      acrValues: toFullyQualifiedSpidLevel(input.minAuthLevel),
      clientId,
      scope: "openid",
      state,
      nonce,
      responseType: "code",
      redirectUri,
      authorizationEndpoint: authorizationEndpointResult.value,
      idp: input.idp,
    });
  };
