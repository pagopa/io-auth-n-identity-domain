import { GenericError, NonEmptyString, UseCase } from "@pagopa/hexagonal-core";
import { IPString } from "@pagopa/io-auth-n-identity-domain";
import { LoginType } from "@pagopa/io-auth-n-identity-session";
import {
  type BaseSession,
  newPlainSessionTokens,
  type SessionWithHashedSSOTokens,
  type SessionWithPlainSSOTokens,
  toHashedSessionTokens,
} from "@pagopa/io-auth-n-identity-session/entities";
import type { SessionPort } from "@pagopa/io-auth-n-identity-session/ports";
import {
  toPlainBpdSSOToken,
  toPlainFimsSSOToken,
  toPlainPagopaSSOToken,
  toPlainZendeskSSOToken,
} from "@pagopa/io-auth-n-identity-session/value-objects";
import type {
  PlainSessionToken,
  SessionId,
} from "@pagopa/io-auth-n-identity-session/value-objects";
import { err, ok } from "neverthrow";

import {
  ClientSessionToken,
  ClientSessionTokenSchema,
} from "../../domain/value-objects/client-session-token.vo.js";

export type SessionInfo = Omit<
  BaseSession,
  "sessionId" | "expirationDate" | "createdAt"
> & {
  ipAddress: IPString;
  loginType: LoginType;
  identityProvider: NonEmptyString;
};

export type RefreshUserSessionUseCaseInput = {
  sessionToken: SessionInfo;
  oldSession?: PreviousSession;
};

export type PreviousSession = {
  session: BaseSession;
  sessionId: SessionId;
  sessionToken: PlainSessionToken;
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
  async ({ sessionToken, oldSession }) => {
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
    let oldHashedSessionTokens: SessionWithHashedSSOTokens;
    if (oldSession?.sessionId === activeSession.sessionId) {
      const oldPlainSessionTokens: SessionWithPlainSSOTokens = {
        ...oldSession.session,
        sessionId: oldSession.sessionId,
        plainSessionToken: oldSession.sessionToken,
        ssoTokens: {
          bpdPlainToken: toPlainBpdSSOToken(oldSession.sessionToken),
          fimsPlainToken: toPlainFimsSSOToken(oldSession.sessionToken),
          pagopaPlainToken: toPlainPagopaSSOToken(oldSession.sessionToken),
          zendeskPlainToken: toPlainZendeskSSOToken(oldSession.sessionToken),
        },
      };
      oldHashedSessionTokens = toHashedSessionTokens(oldPlainSessionTokens);
    } else {
      const oldSessionResult =
        await deps.sessionPort.findSessionTokensBySessionId(
          activeSession.sessionId,
        );
      if (oldSessionResult.isErr()) {
        return err(
          new GenericError(
            `Failed to retrieve previous session tokens: ${oldSessionResult.error.message}`,
          ),
        );
      }
      oldHashedSessionTokens = oldSessionResult.value;
    }

    const refreshResult = await deps.sessionPort.refresh(
      hashedSessionTokens,
      oldHashedSessionTokens,
    );

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
