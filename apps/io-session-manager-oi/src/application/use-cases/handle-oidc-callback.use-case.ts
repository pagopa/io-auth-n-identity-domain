import {
  AuthenticationError,
  GenericError,
  NonEmptyString,
  NotFoundError,
  UseCase,
} from "@pagopa/hexagonal-core";
import { IPString } from "@pagopa/io-auth-n-identity-domain";
import { err, ok } from "neverthrow";

import { AusiliarDataPort } from "../../domain/ports/outbound/ausiliar-data.port.js";
import { OidcClientPort } from "../../domain/ports/outbound/oidc.port.js";
import { ClientSessionToken } from "../../domain/value-objects/client-session-token.vo.js";
import {
  ActivateUserSessionUseCase,
  NewSessionToken,
} from "./activate-user-session.use-case.js";

// Error code sent to the client error page when the provider returns an error
// response without an explicit `error` code.
export const GENERIC_LOGIN_ERROR_CODE = "GENERIC_ERROR" as NonEmptyString;

// Decoded OIDC callback: `state` is always present; a present `code` marks a
// success response, otherwise it is a provider error response
// (`error`/`error_description`, RFC 6749 §4.1.2.1).
export type OidcCallbackParams = {
  state: NonEmptyString;
  code?: NonEmptyString;
  error?: NonEmptyString;
  error_description?: NonEmptyString;
};

export type HandleOidcCallbackInput = {
  callback: OidcCallbackParams;
  ipAddress: IPString;
};

export type HandleOidcCallbackDeps = {
  ausiliarDataPort: AusiliarDataPort;
  oidcPort: OidcClientPort;
  activateUserSessionUseCase: ActivateUserSessionUseCase;
};

// Business outcome of the callback: a session token on success, or a login
// error code (with an optional message) forwarded to the client error page.
// Both variants are turned into a client redirect by the inbound handler;
// unexpected failures stay on the error channel and become a problem+json.
export type HandleOidcCallbackOutput =
  | { readonly outcome: "success"; readonly token: ClientSessionToken }
  | {
      readonly outcome: "error";
      readonly errorCode: NonEmptyString;
      readonly errorMessage?: NonEmptyString;
    };

// ---------------------------------------------------------------
// Orchestrates the OIDC callback: retrieves the login auxiliary
// data, exchanges the authorization code for the ID token claims,
// then delegates to the activate-user-session use-case.
// ---------------------------------------------------------------

export const makeHandleOidcCallbackUseCase =
  (
    deps: HandleOidcCallbackDeps,
  ): UseCase<
    HandleOidcCallbackInput,
    HandleOidcCallbackOutput,
    AuthenticationError | GenericError
  > =>
  async ({ callback, ipAddress }) => {
    // Retrieve (and, once on Redis getDel, consume) the reserved login data
    // even for an error response, so the state cannot be replayed.
    const ausiliarDataResult = await deps.ausiliarDataPort.retrieve(
      callback.state,
    );
    if (ausiliarDataResult.isErr()) {
      return ausiliarDataResult.error instanceof NotFoundError
        ? err(new AuthenticationError())
        : err(new GenericError(ausiliarDataResult.error.message));
    }
    const ausiliarData = ausiliarDataResult.value;

    if (callback.code === undefined) {
      return ok({
        outcome: "error",
        errorCode: callback.error ?? GENERIC_LOGIN_ERROR_CODE,
        errorMessage: callback.error_description,
      });
    }

    const exchangeResult = await deps.oidcPort.exchange({
      env: ausiliarData.oidcConfigurationEnv,
      code: callback.code,
      state: callback.state,
      expectedNonce: ausiliarData.nonce,
    });
    if (exchangeResult.isErr()) {
      return err(exchangeResult.error);
    }
    const claims = exchangeResult.value;

    const newSessionToken: NewSessionToken = {
      fiscalCode: claims.fiscalNumber,
      name: claims.name,
      familyName: claims.familyName,
      dateOfBirth: claims.dateOfBirth,
      spidLevel: claims.acr,
      spidEmail: claims.email,
      ipAddress,
      loginType: ausiliarData.loginType,
      //TODO: map to readable Identity Provider name
      identityProvider: claims.iss,
    };

    const activateResult =
      await deps.activateUserSessionUseCase(newSessionToken);
    if (activateResult.isErr()) {
      return err(activateResult.error);
    }

    return ok({ outcome: "success", token: activateResult.value });
  };
