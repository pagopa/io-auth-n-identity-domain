import { QueueClient, QueueSendMessageResponse } from "@azure/storage-queue";
import * as RTE from "fp-ts/ReaderTaskEither";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import { sha256 } from "@pagopa/io-functions-commons/dist/src/utils/crypto";
import * as TE from "fp-ts/TaskEither";
import { pipe } from "fp-ts/lib/function";
import * as E from "fp-ts/Either";
import { KindEnum as DeleteKind } from "../types/notifications";
import {
  DeleteInstallationMessage,
  NotificationMessageKindEnum,
} from "../types/notifications";
import { base64EncodeObject } from "../utils/encoding";

export type NotificationsueueDeps = {
  notificationQueueClient: QueueClient;
};

export const deleteInstallation: (
  fiscalCode: FiscalCode,
) => RTE.ReaderTaskEither<
  NotificationsueueDeps,
  Error,
  QueueSendMessageResponse
> = (fiscalCode) => (deps) => {
  const deleteMessage: DeleteInstallationMessage = {
    installationId: sha256(fiscalCode),
    kind: DeleteKind[NotificationMessageKindEnum.DeleteInstallation],
  };
  return pipe(
    TE.tryCatch(
      () =>
        deps.notificationQueueClient.sendMessage(
          base64EncodeObject(deleteMessage),
        ),
      E.toError,
    ),
  );
};
