import type { QueueClient } from "@azure/storage-queue";
import { GenericError } from "@pagopa/hexagonal-core";
import {
  HealthCheckOutboundPort,
  LollipopAssertionRef,
} from "@pagopa/io-auth-n-identity-domain";
import { err, ok, type Result } from "neverthrow";
import type { LollipopRevocationPort } from "../../domain/ports/outbound/lollipop-revocation.port.js";
import { Base64 } from "../../utils/codec/index.js";

export class LollipopRevocationQueueAdapter
  implements LollipopRevocationPort, HealthCheckOutboundPort
{
  constructor(private readonly queueClient: QueueClient) {}

  async healthcheck(): Promise<Result<void, GenericError>> {
    try {
      await this.queueClient.getProperties();
      return ok(undefined);
    } catch (error) {
      return err(
        new GenericError(
          `Failed to perform healthcheck on notification queue: ${
            error instanceof Error ? error.message : String(error)
          }`,
        ),
      );
    }
  }

  async requestRevocation(
    assertionRef: LollipopAssertionRef,
  ): Promise<Result<void, GenericError>> {
    try {
      const response = await this.queueClient.sendMessage(
        Base64.encode({ assertion_ref: assertionRef }), // TODO: Consider to validate/parse the structure of the message before sending
      );
      if (response.errorCode) {
        return err(
          new GenericError(
            `Failed to request Lollipop revocation: ${response.errorCode}`,
          ),
        );
      }
      return ok(undefined);
    } catch (error) {
      return err(
        new GenericError(
          `Failed to request Lollipop revocation: ${
            error instanceof Error ? error.message : String(error)
          }`,
        ),
      );
    }
  }
}
