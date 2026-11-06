import { GenericError, type UseCase } from "@pagopa/hexagonal-core";
import type { BaseSession } from "@pagopa/io-auth-n-identity-session";
import { err, ok } from "neverthrow";

import type { AuthEventPort } from "../../domain/ports/outbound/auth-event.port.js";

import type { InvalidatePreviousUserStateUseCase } from "./invalidate-previous-user-state.use-case.js";

type LogoutInput = {
  session: BaseSession;
};

export type LogoutUseCase = UseCase<LogoutInput, void, GenericError>;

type LogoutUseCaseDeps = {
  authEventPort: AuthEventPort;
  invalidatePreviousUserStateUseCase: InvalidatePreviousUserStateUseCase;
};

export const makeLogoutUseCase =
  (deps: LogoutUseCaseDeps): LogoutUseCase =>
  async ({ session }) => {
    const invalidationResult = await deps.invalidatePreviousUserStateUseCase(
      session.fiscalCode,
    );
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
