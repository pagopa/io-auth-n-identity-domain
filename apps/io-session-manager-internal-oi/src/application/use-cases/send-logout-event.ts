import type { GenericError, UseCase } from "@pagopa/hexagonal-core";
import type { Logger } from "@pagopa/hexagonal-core/domain/ports";
import type { AuthEvent } from "@pagopa/io-auth-n-identity-session";
import type { AuthEventPort } from "@pagopa/io-session-manager-core";

type SendLogoutEventDeps = {
  authEventPort: AuthEventPort;
  logger: Logger;
};

type LogoutEvent = Extract<AuthEvent, { eventType: "logout" }>;

export type SendLogoutEventUseCase = UseCase<LogoutEvent, void, GenericError>;

/**
 * Publishes a logout event, tracking a telemetry event when the publishing fails.
 */
export const makeSendLogoutEventUseCase =
  (deps: SendLogoutEventDeps): SendLogoutEventUseCase =>
  async (event) => {
    const result = await deps.authEventPort.sendEvent(event);
    if (result.isErr()) {
      deps.logger.trackEvent({
        name: "service-bus.auth-event.emission-failure",
        properties: {
          eventData: JSON.stringify(event),
          message: result.error.message,
        },
      });
    }
    return result;
  };
