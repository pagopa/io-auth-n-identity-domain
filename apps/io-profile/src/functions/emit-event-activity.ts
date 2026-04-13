import { InvocationContext } from "@azure/functions";
import { QueueServiceClient } from "@azure/storage-queue";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";

export const ActivityName = "EmitEventActivity";

export const getEmitEventActivityHandler =
  (
    eventsQueueServiceClient: QueueServiceClient,
    eventsQueueName: NonEmptyString,
  ) =>
  async (input: unknown, _context: InvocationContext): Promise<void> => {
    const message = typeof input === "string" ? input : JSON.stringify(input);
    await eventsQueueServiceClient
      .getQueueClient(eventsQueueName)
      .sendMessage(Buffer.from(message).toString("base64"));
  };
