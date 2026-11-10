import { GenericError, type UseCase } from "@pagopa/hexagonal-core";
import type { BaseSession } from "@pagopa/io-auth-n-identity-session";
import { toHashedSessionTokens } from "@pagopa/io-auth-n-identity-session/entities";
import {
  type PlainSessionToken,
  toPlainBpdSSOToken,
  toPlainFimsSSOToken,
  toPlainPagopaSSOToken,
  toPlainZendeskSSOToken,
} from "@pagopa/io-auth-n-identity-session/value-objects";
import { err, ok } from "neverthrow";

import type { AuthEventPort } from "../../domain/ports/outbound/auth-event.port.js";

import type { InvalidateProvidedUserStateUseCase } from "./invalidate-provided-user-state.use-case.js";

type LogoutInput = {
  session: BaseSession;
  sessionToken: PlainSessionToken;
};

export type LogoutUseCase = UseCase<LogoutInput, void, GenericError>;

type LogoutUseCaseDeps = {
  authEventPort: AuthEventPort;
  invalidateProvidedUserStateUseCase: InvalidateProvidedUserStateUseCase;
};

/**
 * Creates the logout use case using dependency injection through a factory function.
 *
 * Derives hashed session and SSO tokens from the authenticated plain token,
 * delegates cleanup to the provided-user-state invalidation use case, then emits
 * the app logout event. Cleanup errors prevent event emission; event errors
 * are returned without rolling back cleanup.
 *
 * @param deps - Logout event port and provided-user-state invalidation use case.
 * @returns A use case accepting the authenticated session and its plain token.
 */
export const makeLogoutUseCase =
  (deps: LogoutUseCaseDeps): LogoutUseCase =>
  async ({ session, sessionToken }) => {
    const hashedSession = toHashedSessionTokens({
      ...session,
      plainSessionToken: sessionToken,
      ssoTokens: {
        bpdPlainToken: toPlainBpdSSOToken(sessionToken),
        fimsPlainToken: toPlainFimsSSOToken(sessionToken),
        pagopaPlainToken: toPlainPagopaSSOToken(sessionToken),
        zendeskPlainToken: toPlainZendeskSSOToken(sessionToken),
      },
    });
    const invalidationResult =
      await deps.invalidateProvidedUserStateUseCase(hashedSession);
    if (invalidationResult.isErr()) {
      return err(invalidationResult.error);
    }

    const eventResult = await deps.authEventPort.sendEvent({
      eventType: "logout",
      fiscalCode: session.fiscalCode,
      scenario: "app",
      ts: new Date(),
    });
    if (eventResult.isErr()) {
      return err(
        new GenericError(
          `Failed to emit logout event: ${eventResult.error.message}`,
        ),
      );
    }

    return ok(undefined);
  };
