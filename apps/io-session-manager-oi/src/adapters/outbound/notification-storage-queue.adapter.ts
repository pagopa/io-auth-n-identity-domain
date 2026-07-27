import { QueueClient } from "@azure/storage-queue";
import { FiscalCode, GenericError } from "@pagopa/hexagonal-core";
import { err, ok, Result, ResultAsync } from "neverthrow";
import { NotificationPort } from "../../domain/ports/outbound/notification.port.js";
import { Base64 } from "../../utils/codec/index.js";
import { Hash } from "../../utils/crypto/index.js";

/**
 * NotificationStorageQueueAdapter is an implementation of the NotificationOutboundPort interface that uses Azure Storage Queue to send messages for deleting installations.
 */
export class NotificationStorageQueueAdapter implements NotificationPort {
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

  async deleteInstallation(
    fiscalCode: FiscalCode,
  ): Promise<Result<undefined, GenericError>> {
    return ResultAsync.fromPromise(
      this.queueClient.sendMessage(
        Base64.encode({
          installationId: Hash.sha256(fiscalCode),
          kind: "DeleteInstallation",
        }),
      ),
      (error) =>
        new Error(error instanceof Error ? error.message : String(error)),
    )
      .andThen((response) =>
        response.errorCode ? err(new Error(response.errorCode)) : ok(undefined),
      )
      .mapErr(
        (error) =>
          new GenericError(
            `Failed to send delete installation message: ${error.message}`,
          ),
      );
  }
}
