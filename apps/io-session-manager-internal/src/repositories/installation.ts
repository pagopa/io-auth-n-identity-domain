import { QueueClient, QueueSendMessageResponse } from "@azure/storage-queue";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/lib/TaskEither";
import * as E from "fp-ts/lib/Either";
import { sha256 } from "@pagopa/io-functions-commons/dist/src/utils/crypto";
import * as RTE from "fp-ts/ReaderTaskEither";
import {
  DeleteInstallationKindEnum,
  DeleteInstallationMessage,
  NotificationMessageKindEnum,
} from "../types/notifications";
import { base64EncodeObject } from "../utils/encoding";

type Dependencies = {
  NotificationQueueClient: QueueClient;
};

const deleteInstallation =
  (
    fiscalCode: FiscalCode,
  ): RTE.ReaderTaskEither<Dependencies, Error, QueueSendMessageResponse> =>
  (deps) => {
    const deleteMessage: DeleteInstallationMessage = {
      installationId: sha256(fiscalCode),
      kind: DeleteInstallationKindEnum[
        NotificationMessageKindEnum.DeleteInstallation
      ],
    };
    return pipe(
      TE.tryCatch(
        () =>
          deps.NotificationQueueClient.sendMessage(
            base64EncodeObject(deleteMessage),
          ),
        E.toError,
      ),
    );
  };

export type InstallationRepository = typeof InstallationRepository;
export const InstallationRepository = { deleteInstallation };
