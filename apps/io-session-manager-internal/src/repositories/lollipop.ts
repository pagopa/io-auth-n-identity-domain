import { QueueClient, QueueSendMessageResponse } from "@azure/storage-queue";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as TE from "fp-ts/lib/TaskEither";
import { constVoid, pipe } from "fp-ts/lib/function";
import * as E from "fp-ts/lib/Either";
import { RevokeAssertionRefInfo } from "@pagopa/io-functions-commons/dist/src/entities/revoke_assertion_ref_info";
import { Reader } from "fp-ts/lib/Reader";
import { AssertionRef } from "../generated/definitions/external/AssertionRef";
import { base64EncodeObject } from "../utils/encoding";

export type Dependencies = {
  RevokeAssertionRefQueueClient: QueueClient;
};

const revokePreviousAssertionRef: (
  assertionRef: AssertionRef,
) => Reader<Dependencies, Promise<QueueSendMessageResponse>> =
  (assertionRef) => (deps) => {
    const revokeMessage = RevokeAssertionRefInfo.encode({
      assertion_ref: assertionRef,
    });
    return deps.RevokeAssertionRefQueueClient.sendMessage(
      base64EncodeObject(revokeMessage),
    );
  };

const fireAndForgetRevokeAssertionRef: (
  assertionRef: AssertionRef,
) => RTE.ReaderTaskEither<Dependencies, Error, true> =
  (assertionRef) => (deps) =>
    pipe(
      TE.tryCatch(
        () =>
          // fire and forget the queue message
          new Promise<true>((resolve) => {
            revokePreviousAssertionRef(assertionRef)(deps).catch(constVoid);
            resolve(true);
          }),
        E.toError,
      ),
    );

export type LollipopRepository = typeof LollipopRepository;
export const LollipopRepository = { fireAndForgetRevokeAssertionRef };
