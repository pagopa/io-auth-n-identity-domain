import { QueueClient, QueueSendMessageResponse } from "@azure/storage-queue";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as TE from "fp-ts/TaskEither";
import * as E from "fp-ts/Either";
import { RevokeAssertionRefInfo } from "@pagopa/io-functions-commons/dist/src/entities/revoke_assertion_ref_info";
import { AssertionRef } from "../generated/lollipop-api/AssertionRef";
import { base64EncodeObject } from "../utils/encoding";

export type RevokeAssertionRefDeps = {
  lollipopRevokeQueueClient: QueueClient;
};

export const revokePreviousAssertionRef: (
  assertionRef: AssertionRef,
) => RTE.ReaderTaskEither<
  RevokeAssertionRefDeps,
  Error,
  QueueSendMessageResponse
> = (assertionRef) => (deps) => {
  const revokeMessage = RevokeAssertionRefInfo.encode({
    assertion_ref: assertionRef,
  });
  return TE.tryCatch(
    () =>
      deps.lollipopRevokeQueueClient.sendMessage(
        base64EncodeObject(revokeMessage),
      ),
    E.toError,
  );
};
