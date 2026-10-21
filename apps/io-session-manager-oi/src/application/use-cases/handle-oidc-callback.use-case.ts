import {
  AuthenticationError,
  GenericError,
  NonEmptyString,
  NotFoundError,
  UseCase,
  ValidationError,
} from "@pagopa/hexagonal-core";
import { IPString } from "@pagopa/io-auth-n-identity-domain";
import { err, ok } from "neverthrow";

import { AuxiliaryDataPort } from "../../domain/ports/outbound/auxiliary-data.port.js";
import { IdentityAssertionFetcherPort } from "../../domain/ports/outbound/identity-assertion-fetcher.port.js";
import { OidcClientPort } from "../../domain/ports/outbound/oidc.port.js";
import { ClientSessionToken } from "../../domain/value-objects/client-session-token.vo.js";

import { SpidLevel } from "@pagopa/io-auth-n-identity-session";
import { SpidAuthLevel } from "../../domain/value-objects/login.vo.js";
import { ActivateUserSessionUseCase } from "./activate-user-session.use-case.js";

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
  auxiliaryDataPort: AuxiliaryDataPort;
  oidcPort: OidcClientPort;
  identityAssertionFetcherPort: IdentityAssertionFetcherPort;
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
    AuthenticationError | ValidationError | GenericError
  > =>
  async ({ callback, ipAddress }) => {
    // Retrieve (and, once on Redis getDel, consume) the reserved login data
    // even for an error response, so the state cannot be replayed.
    const auxiliaryDataResult = await deps.auxiliaryDataPort.retrieve(
      callback.state,
    );
    if (auxiliaryDataResult.isErr()) {
      return auxiliaryDataResult.error instanceof NotFoundError
        ? err(new AuthenticationError())
        : err(new GenericError(auxiliaryDataResult.error.message));
    }
    const auxiliaryData = auxiliaryDataResult.value;

    if (callback.code === undefined) {
      return ok({
        outcome: "error",
        errorCode: callback.error ?? GENERIC_LOGIN_ERROR_CODE,
        errorMessage: callback.error_description,
      });
    }

    /**********************/
    /* OIDC code exchange */
    /**********************/

    const exchangeResult = await deps.oidcPort.exchange({
      env: auxiliaryData.oidcConfigurationEnv,
      code: callback.code,
      state: callback.state,
      expectedNonce: auxiliaryData.nonce,
    });
    if (exchangeResult.isErr()) {
      return err(exchangeResult.error);
    }
    const idTokenClaims = exchangeResult.value.claims;

    /***********************************/
    /* OIDC ID token claims validation */
    /***********************************/

    if (
      !isSpidLevelGreaterOrEqual(idTokenClaims.acr, auxiliaryData.minAuthLevel)
    ) {
      return err(
        new ValidationError(
          `Insufficient SPID level: required ${auxiliaryData.minAuthLevel}, received ${idTokenClaims.acr.replace("https://www.spid.gov.it/", "")}`,
        ),
      );
    }

    /********************************/
    /* Identity assertion retrieval */
    /********************************/

    const assertionResult =
      await deps.identityAssertionFetcherPort.getAssertion(
        auxiliaryData.oidcConfigurationEnv,
        exchangeResult.value.accessToken,
      );
    if (assertionResult.isErr()) {
      switch (assertionResult.error.kind) {
        case "ValidationError":
          return err(new GenericError(assertionResult.error.message));
        case "GenericError":
          return err(assertionResult.error);
        default: {
          const _exhaustiveCheck: never = assertionResult.error;
          return err(new GenericError("Unhandled error kind"));
        }
      }
    }
    const assertion = assertionResult.value;

    /*****************************************/
    /* Identity assertion consistency checks */
    /*****************************************/

    if (assertion.claims.fiscalCode !== idTokenClaims.fiscalNumber) {
      return err(
        new ValidationError(
          `Fiscal number mismatch between id token and ${assertion.type} identity assertion`,
        ),
      );
    }

    if (assertion.assertionRef !== auxiliaryData.lollipopAssertionRef) {
      return err(
        new ValidationError(
          `Assertion reference mismatch between auxiliary data and ${assertion.type} identity assertion`,
        ),
      );
    }

    /***************************/
    /* User session activation */
    /***************************/

    const newSessionToken = {
      fiscalCode: idTokenClaims.fiscalNumber,
      name: idTokenClaims.name,
      familyName: idTokenClaims.familyName,
      dateOfBirth: idTokenClaims.dateOfBirth,
      spidLevel: idTokenClaims.acr,
      spidEmail: idTokenClaims.email,
      ipAddress,
      loginType: auxiliaryData.loginType,
      //TODO: map to readable Identity Provider name
      identityProvider: idTokenClaims.iss,
    };
    const activateResult = await deps.activateUserSessionUseCase({
      sessionToken: newSessionToken,
      assertion: {
        assertionRef: assertion.assertionRef,
        rawAssertion: assertion.rawAssertion,
        type: assertion.type,
      },
    });
    if (activateResult.isErr()) {
      return err(activateResult.error);
    }

    return ok({ outcome: "success", token: activateResult.value });
  };

const SPID_LEVEL_ORDER: Record<SpidLevel, number> = {
  "https://www.spid.gov.it/SpidL1": 1,
  "https://www.spid.gov.it/SpidL2": 2,
  "https://www.spid.gov.it/SpidL3": 3,
};

const toFullyQualifiedSpidLevel = (level: SpidAuthLevel): SpidLevel =>
  `https://www.spid.gov.it/${level}`;

/**
 * Compares a SPID level (as carried by the claim, in its
 * canonical URL form) against a SPID auth level, returning `true` if
 * `spidLevelReceived` grants an authentication level equal or greater than `minAuthLevel`.
 *
 * SpidL1 < SpidL2 < SpidL3
 */
const isSpidLevelGreaterOrEqual = (
  spidLevelReceived: SpidLevel,
  minAuthLevel: SpidAuthLevel,
): boolean =>
  SPID_LEVEL_ORDER[spidLevelReceived] >=
  SPID_LEVEL_ORDER[toFullyQualifiedSpidLevel(minAuthLevel)];
