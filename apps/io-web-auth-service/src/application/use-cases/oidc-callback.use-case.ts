import {
  ForbiddenError,
  GenericError,
  NonEmptyString,
  NotFoundError,
  UseCase,
  ValidationError,
} from "@pagopa/hexagonal-core";
import type { Logger } from "@pagopa/hexagonal-core/domain/ports";
import { type IPString } from "@pagopa/io-auth-n-identity-domain";
import { err, ok, type Result } from "neverthrow";

import { AuxiliaryDataPort } from "../../domain/ports/outbound/auxiliary-data.port.js";
import { OidcClientPort } from "../../domain/ports/outbound/oidc.port.js";
import { type LoginAuxiliaryData } from "../../domain/value-objects/login.vo.js";
import {
  OidcCallbackErrorParamsSchema,
  type OidcCallbackParams,
  OidcCallbackSuccessParamsSchema,
} from "../../domain/value-objects/oidc.vo.js";
import { sha256 } from "../../utils/crypto/hash.js";

import { type ActivateUserSessionUseCase } from "./activate-user-session.use-case.js";

export type HandleOidcCallbackInput = {
  callback: OidcCallbackParams;
  ipAddress: IPString;
};

export type HandleOidcCallbackDeps = {
  logger: Logger;
  auxiliaryDataPort: AuxiliaryDataPort;
  oidcClientPort: OidcClientPort;
  activateUserSessionUseCase: ActivateUserSessionUseCase;
};

// Business outcome of the callback: a session token on success, or a login
// error code (with an optional message) forwarded to the client error page.
// Both variants are turned into a client redirect by the inbound handler;
// unexpected failures stay on the error channel and become a problem+json.
export type HandleOidcCallbackOutput =
  | { readonly outcome: "success"; readonly token: NonEmptyString }
  | {
      readonly outcome: "error";
      readonly errorCode?: number;
      readonly errorMessage: NonEmptyString;
    };

// ----------------------------------------------------------------------
// Use case for handling OIDC callback
// ----------------------------------------------------------------------
export const makeHandleOidcCallbackUseCase =
  (
    deps: HandleOidcCallbackDeps,
  ): UseCase<
    HandleOidcCallbackInput,
    HandleOidcCallbackOutput,
    ValidationError | ForbiddenError | GenericError
  > =>
  async ({ callback, ipAddress }) => {
    const logger = deps.logger.with({ ipHash: sha256(ipAddress) });

    const successDecode = OidcCallbackSuccessParamsSchema.safeParse(callback);
    if (!successDecode.success) {
      discardAuxiliaryData(deps.auxiliaryDataPort, callback.state, logger);
      return ok(parseCallbackQueryParamsError(callback, logger));
    }

    const { state, code } = successDecode.data;
    const auxiliaryDataResult = await retrieveAuxiliaryData(
      deps.auxiliaryDataPort,
      state,
      logger,
    );
    if (auxiliaryDataResult.isErr()) {
      return err(auxiliaryDataResult.error);
    }
    const auxiliaryData = auxiliaryDataResult.value;

    const flowProperties = {
      env: auxiliaryData.oidcConfigurationEnv,
      state,
      nonce: auxiliaryData.nonce,
    };

    //-----------------------
    // OIDC code exchange
    //-----------------------
    const exchangeResult = await deps.oidcClientPort.exchange({
      env: auxiliaryData.oidcConfigurationEnv,
      code,
      state,
      expectedNonce: auxiliaryData.nonce,
    });
    if (exchangeResult.isErr()) {
      const error = exchangeResult.error;
      logger.trackEvent({
        name:
          error.reason === "discovery_failed"
            ? "ioweb-auth.oidc.callback.discovery.error"
            : "ioweb-auth.oidc.callback.code-exchange.error",
        properties: {
          samplingEnabled: false,
          ...flowProperties,
          failureReason: error.reason,
        },
      });
      return err(error);
    }
    const idTokenClaims = exchangeResult.value;
    const identityProperties = {
      ...flowProperties,
      acr: idTokenClaims.acr,
      idpEntityId: idTokenClaims.idpEntityId,
    };

    /***************************/
    /* User session activation */
    /***************************/
    const sessionTokenResult = await deps.activateUserSessionUseCase({
      fiscalCode: idTokenClaims.fiscalNumber,
      name: idTokenClaims.name,
      familyName: idTokenClaims.familyName,
      spidLevel: idTokenClaims.acr,
    });
    if (sessionTokenResult.isErr()) {
      logger.trackEvent({
        name: "ioweb-auth.oidc.callback.domain.error",
        properties: {
          samplingEnabled: false,
          ...identityProperties,
          failureReason: "session_activation_failed",
        },
      });
      return err(sessionTokenResult.error);
    }

    logger.trackEvent({
      name: "ioweb-auth.oidc.callback.verified.info",
      properties: { samplingEnabled: false, ...identityProperties },
    });

    return ok({ outcome: "success", token: sessionTokenResult.value });
  };

// ----------------------------------------------------------------------
// Private methods
// ----------------------------------------------------------------------

const parseCallbackQueryParamsError = (
  params: OidcCallbackParams,
  logger: Logger,
): HandleOidcCallbackOutput => {
  const eventProperties = {
    samplingEnabled: false,
    redirectTarget: "client_error",
    state: params.state,
  };

  const errorDecode = OidcCallbackErrorParamsSchema.safeParse(params);
  if (!errorDecode.success) {
    logger.trackEvent({
      name: "ioweb-auth.oidc.callback.upstream-error.warning",
      properties: {
        ...eventProperties,
        failureReason: "invalid_callback_input",
      },
    });
    return {
      outcome: "error",
      errorCode: undefined,
      errorMessage: "invalid OIDC error callback inputs" as NonEmptyString,
    };
  }
  const { error, error_description: description } = errorDecode.data;
  logger.trackEvent({
    name: "ioweb-auth.oidc.callback.upstream-error.warning",
    properties: {
      ...eventProperties,
      oiError: error,
      ...(description === undefined ? {} : { oiErrorDescription: description }),
    },
  });
  // The provider error code, when present, is carried by error_description
  return {
    outcome: "error",
    errorCode: parseInt(description ?? "", 10) || undefined,
    errorMessage: error,
  };
};

/**
 * Best-effort (fire & forget) removal of the auxiliary data reserved for
 * `state`, so that a login that ended with an error cannot be resumed.
 * Failures are only tracked: they must never prevent the error redirect.
 */
const discardAuxiliaryData = (
  auxiliaryDataPort: AuxiliaryDataPort,
  state: NonEmptyString,
  logger: Logger,
): void => {
  const trackCleanupFailure = (): void =>
    logger.trackEvent({
      name: "ioweb-auth.oidc.callback.auxiliary-remediation.warning",
      properties: {
        samplingEnabled: false,
        state,
        failureReason: "auxiliary_data_cleanup_failed",
      },
    });

  auxiliaryDataPort.retrieve(state).then((result) => {
    // A missing state means there is nothing left to clean up.
    if (result.isErr() && !(result.error instanceof NotFoundError)) {
      trackCleanupFailure();
    }
  }, trackCleanupFailure);
};

/**
 * Retrieves and consumes the login data reserved for `state`,
 * so that the state cannot be replayed.
 */
const retrieveAuxiliaryData = async (
  auxiliaryDataPort: AuxiliaryDataPort,
  state: NonEmptyString,
  logger: Logger,
): Promise<Result<LoginAuxiliaryData, ValidationError>> => {
  const result = await auxiliaryDataPort.retrieve(state);
  if (result.isErr()) {
    // the state is either unknown/forged or has already been consumed,
    // hence not retriable
    logger.trackEvent({
      name: "ioweb-auth.oidc.callback.auxiliary-data.error",
      properties: {
        samplingEnabled: false,
        state,
        failureReason: "auxiliary_data_unavailable",
      },
    });
    return err(new ValidationError("Missing or expired login state"));
  }
  return ok(result.value);
};
