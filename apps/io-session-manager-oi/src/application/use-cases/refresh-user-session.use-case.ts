import {
  AuthenticationError,
  GenericError,
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
};

type RefreshUserSessionUseCaseInput = {
  sessionToken: SessionInfo;
};

export type RefreshUserSessionUseCase = UseCase<
  RefreshUserSessionUseCaseInput,
  ClientSessionToken,
  AuthenticationError | GenericError
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
      // Fast Login can only refresh a session that is still active
      if (activeSessionResult.error instanceof NotFoundError) {
        return err(new AuthenticationError());
      }
      return err(
        new GenericError(
          `Failed to retrieve active session: ${activeSessionResult.error.message}`,
        ),
      );
    }
    const activeSession = activeSessionResult.value;

    /****************************************************************/
    /* Find the previous session token, before refresh deletes it   */
    /****************************************************************/
    const previousSessionTokenResult =
      await deps.sessionPort.findSessionTokenBySessionId(
        activeSession.sessionId,
      );

    if (previousSessionTokenResult.isErr()) {
      return err(
        new GenericError(
          `Failed to retrieve previous session token: ${previousSessionTokenResult.error.message}`,
        ),
      );
    }
    const previousSessionToken = previousSessionTokenResult.value;

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
      idp: sessionToken.idp,
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

    /******************************************************************/
    /* Invalidate the previous session token cache                    */
    /* Done after the refresh, so that a concurrent request using the */
    /* previous token cannot repopulate the cache from the DB.        */
    /******************************************************************/
    if (previousSessionToken) {
      const invalidationResult =
        await deps.invalidateSessionTokenCacheUseCase(previousSessionToken);
      if (invalidationResult.isErr()) {
        return err(invalidationResult.error);
      }
    }

    return ok(
      ClientSessionTokenSchema.parse(
        `${plainSessionTokens.sessionId}.${plainSessionTokens.plainSessionToken}`,
      ),
    );
  };
