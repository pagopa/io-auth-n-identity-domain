import { GenericError, UseCase } from "@pagopa/hexagonal-core";
import {
  newPlainSessionTokens,
  toHashedSessionTokens,
} from "@pagopa/io-auth-n-identity-session/entities";
import type { SessionPort } from "@pagopa/io-auth-n-identity-session/ports";
import { err, ok } from "neverthrow";

import {
  ClientSessionToken,
  ClientSessionTokenSchema,
} from "../../domain/value-objects/client-session-token.vo.js";

import type { NewSessionToken } from "./activate-user-session.use-case.js";

export type RefreshUserSessionUseCaseInput = {
  sessionToken: NewSessionToken;
};

export type RefreshUserSessionUseCase = UseCase<
  RefreshUserSessionUseCaseInput,
  ClientSessionToken,
  GenericError
>;

type Dependencies = {
  sessionPort: SessionPort;
};

export const makeRefreshUserSessionUseCase =
  (deps: Dependencies): RefreshUserSessionUseCase =>
  async ({ sessionToken }) => {
    const activeSessionResult = await deps.sessionPort.findActiveSession(
      sessionToken.fiscalCode,
    );
    if (activeSessionResult.isErr()) {
      return err(
        new GenericError(
          `Failed to retrieve active session: ${activeSessionResult.error.message}`,
        ),
      );
    }

    const activeSession = activeSessionResult.value;
    const plainSessionTokens = await newPlainSessionTokens({
      fiscalCode: sessionToken.fiscalCode,
      name: sessionToken.name,
      familyName: sessionToken.familyName,
      dateOfBirth: sessionToken.dateOfBirth,
      spidLevel: sessionToken.spidLevel,
      spidEmail: sessionToken.spidEmail,
      sessionId: activeSession.sessionId,
      loginType: activeSession.loginType,
    });
    const hashedSessionTokens = toHashedSessionTokens(plainSessionTokens);
    const refreshResult = await deps.sessionPort.refresh(hashedSessionTokens);

    if (refreshResult.isErr()) {
      return err(
        new GenericError(
          `Failed to refresh user session: ${refreshResult.error.message}`,
        ),
      );
    }

    return ok(
      ClientSessionTokenSchema.parse(
        `${plainSessionTokens.sessionId}.${plainSessionTokens.plainSessionToken}`,
      ),
    );
  };
