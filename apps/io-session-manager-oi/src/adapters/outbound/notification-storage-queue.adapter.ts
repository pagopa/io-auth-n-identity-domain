import { QueueClient } from "@azure/storage-queue";
import { FiscalCode, GenericError } from "@pagopa/hexagonal-core";
import { err, ok, Result, ResultAsync } from "neverthrow";
import { NotificationOutboundPort } from "../../domain/ports/outbound/notification.port.js";
import { Base64 } from "../../utils/codec.js";
import { Hash } from "../../utils/crypto.js";

/**
 * NotificationStorageQueueAdapter is an implementation of the NotificationOutboundPort interface that uses Azure Storage Queue to send messages for deleting installations.
 */
export class NotificationStorageQueueAdapter
  implements NotificationOutboundPort
{
  constructor(private readonly queueClient: QueueClient) {}

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
      .andThen((response) => {
        if (response.errorCode) {
          return err(new Error(response.errorCode));
        }
        return ok(undefined);
      })
      .mapErr((error) => {
        const err = new GenericError(
          `Failed to send delete installation message: ${error.message}`,
        );
        console.log("LOG:" + err.message);
        return err;
      });
  }
}
