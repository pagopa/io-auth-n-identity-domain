import {
  AuthenticationError,
  GenericError,
  NonEmptyStringSchema,
  NotFoundError,
  UseCase,
} from "@pagopa/hexagonal-core";
import { IPString } from "@pagopa/io-auth-n-identity-domain";
import { err } from "neverthrow";
import { z } from "zod";

import { AusiliarDataPort } from "../../domain/ports/outbound/ausiliar-data.port.js";
import { OidcPort } from "../../domain/ports/outbound/oidc.port.js";
import { ClientSessionToken } from "../../domain/value-objects/client-session-token.vo.js";
import {
  ActivateUserSessionUseCase,
  NewSessionToken,
} from "./activate-user-session.use-case.js";

const CallbackQuerySchema = z.object({
  code: NonEmptyStringSchema,
  state: NonEmptyStringSchema,
});

export type HandleOidcCallbackInput = {
  query: Readonly<Record<string, string>>;
  ipAddress: IPString;
};

export type HandleOidcCallbackDeps = {
  ausiliarDataPort: AusiliarDataPort;
  oidcPort: OidcPort;
  activateUserSessionUseCase: ActivateUserSessionUseCase;
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
    ClientSessionToken,
    AuthenticationError | GenericError
  > =>
  async ({ query, ipAddress }) => {
    const parsedQuery = CallbackQuerySchema.safeParse(query);
    if (!parsedQuery.success) {
      return err(new AuthenticationError());
    }
    const { state } = parsedQuery.data;

    const ausiliarDataResult = await deps.ausiliarDataPort.retrieve(state);
    if (ausiliarDataResult.isErr()) {
      return ausiliarDataResult.error instanceof NotFoundError
        ? err(new AuthenticationError())
        : err(new GenericError(ausiliarDataResult.error.message));
    }
    const ausiliarData = ausiliarDataResult.value;

    const exchangeResult = await deps.oidcPort.exchange({
      env: ausiliarData.oidcConfigurationEnv,
      query,
      expectedState: state,
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

    return deps.activateUserSessionUseCase(newSessionToken);
  };
