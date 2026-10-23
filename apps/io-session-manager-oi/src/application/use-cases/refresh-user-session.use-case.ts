import {
  GenericError,
  NonEmptyString,
  NotFoundError,
  UseCase,
} from "@pagopa/hexagonal-core";
import { IPString } from "@pagopa/io-auth-n-identity-domain";
import { LoginType } from "@pagopa/io-auth-n-identity-session";
import {
  type BaseSession,
  newPlainSessionTokens,
  toHashedSessionTokens,
} from "@pagopa/io-auth-n-identity-session/entities";
import type { SessionPort } from "@pagopa/io-auth-n-identity-session/ports";
import { err, ok } from "neverthrow";

import {
  ClientSessionToken,
  ClientSessionTokenSchema,
} from "../../domain/value-objects/client-session-token.vo.js";
import { InvalidateSessionTokenCacheUseCase } from "./invalidate-session-token-cache.use-case.js";

export type SessionInfo = Omit<
  BaseSession,
  "sessionId" | "expirationDate" | "createdAt"
> & {
  ipAddress: IPString;
  loginType: LoginType;
  identityProvider: NonEmptyString;
};

type RefreshUserSessionUseCaseInput = {
  sessionToken: SessionInfo;
};

export type RefreshUserSessionUseCase = UseCase<
  RefreshUserSessionUseCaseInput,
  ClientSessionToken,
  GenericError
>;

type Dependencies = {
  sessionPort: SessionPort;
  invalidateSessionTokenCacheUseCase: InvalidateSessionTokenCacheUseCase;
};

export const makeRefreshUserSessionUseCase =
  (deps: Dependencies): RefreshUserSessionUseCase =>
  async ({ sessionToken }) => {
    /*****************************************************/
    /* Find the Active Session for the given fiscal code */
    /*****************************************************/
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

    /************************************************************/
    /* Invalidate the previous session token cache if it exists */
    /************************************************************/
    const previousSessionTokensResult =
      await deps.sessionPort.findSessionTokenBySessionId(
        activeSession.sessionId,
      );

    if (previousSessionTokensResult.isErr()) {
      return err(
        new GenericError(
          `Failed to retrieve previous session token: ${previousSessionTokensResult.error.message}`,
        ),
      );
    }

    if (previousSessionTokensResult.value) {
      const invalidationResult = await deps.invalidateSessionTokenCacheUseCase(
        previousSessionTokensResult.value,
      );
      if (invalidationResult.isErr()) {
        return err(invalidationResult.error);
      }
    }

    /*************************************/
    /* Generate new plain session tokens */
    /*************************************/
    const plainSessionTokens = await newPlainSessionTokens({
      fiscalCode: sessionToken.fiscalCode,
      name: sessionToken.name,
      familyName: sessionToken.familyName,
      dateOfBirth: sessionToken.dateOfBirth,
      spidLevel: sessionToken.spidLevel,
      spidEmail: sessionToken.spidEmail,
      sessionId: activeSession.sessionId,
      loginType: "LV",
    });

    const hashedSessionTokens = toHashedSessionTokens({
      ...plainSessionTokens,
      expirationDate: new Date(
        Math.min(
          plainSessionTokens.expirationDate.getTime(),
          activeSession.expirationDate.getTime(),
        ),
      ),
    });

    /***************************************/
    /* Refresh the session with new tokens */
    /***************************************/
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
