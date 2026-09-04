import type { ServiceBusSender } from "@azure/service-bus";
import { GenericError } from "@pagopa/hexagonal-core";
import {
  type AuthEvent,
  AuthEventSchema,
} from "@pagopa/io-auth-n-identity-session";
import { err, ok, Result, ResultAsync } from "neverthrow";

import type { AuthEventPort } from "../../domain/ports/outbound/auth-event.port.js";

/**
 * AuthEventServiceBusAdapter is an implementation of the AuthEventPort interface that uses Azure Service Bus to send authentication events.
 */
export class AuthEventServiceBusAdapter implements AuthEventPort {
  constructor(private readonly serviceBusSender: ServiceBusSender) {}

  sendEvent(eventData: AuthEvent): ResultAsync<void, GenericError> {
    return Result.fromThrowable(
      AuthEventSchema.encode,
      (error) =>
        new GenericError(
          `Failed to encode auth event message: ${error instanceof Error ? error.message : String(error)}`,
        ),
    )(eventData)
      .asyncAndThen((body) =>
        ResultAsync.fromPromise(
          this.serviceBusSender.sendMessages({
            body,
            contentType: "application/json",
            applicationProperties: {
              eventType: eventData.eventType, // subscriptions filters apply to applicationProperties
            },
            sessionId: eventData.fiscalCode, // fiscalCode as ServiceBus session identifier
          }),
          (error) =>
            new GenericError(
              `Failed to send auth event message: ${
                error instanceof Error ? error.message : String(error)
              }`,
            ),
        ),
      )
      .map(() => undefined);
  }

  /**
   * Performs a healthcheck on the auth event Service Bus sender.
   * @returns A Result indicating the success or failure of the healthcheck.
   */
  healthcheck(): Promise<Result<void, GenericError>> {
    /*
     Attempt to create a message batch to check the health of the Service Bus sender
     (the SDK must create/open the AMQP sender link to determine the broker-supported maximum batch size).
     It has no message side effects
     */
    return this.serviceBusSender.createMessageBatch().then(
      () => ok(undefined),
      (error) =>
        err(
          new GenericError(
            `Failed to perform healthcheck on auth event Service Bus sender: ${
              error instanceof Error ? error.message : String(error)
            }`,
          ),
        ),
    );
  }
}
