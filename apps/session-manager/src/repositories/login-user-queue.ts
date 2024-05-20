import { QueueClient, QueueSendMessageResponse } from "@azure/storage-queue";
import { UTCISODateFromString } from "@pagopa/ts-commons/lib/dates";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import * as t from "io-ts";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as TE from "fp-ts/TaskEither";
import * as E from "fp-ts/Either";
import { base64EncodeObject } from "../utils/encoding";

export const UserLogin = t.interface({
  fiscalCode: FiscalCode,
  lastLoginAt: UTCISODateFromString,
  source: t.keyof({
    cie: null,
    spid: null,
  }),
});

export type UserLogin = t.TypeOf<typeof UserLogin>;

export type LoginUserEventDeps = {
  loginUserEventQueue: QueueClient;
};

export const logUserLogin: (
  userLogin: UserLogin,
) => RTE.ReaderTaskEither<
  LoginUserEventDeps,
  Error,
  QueueSendMessageResponse
> = (userLogin) => (deps) => {
  const revokeMessage = UserLogin.encode(userLogin);
  return TE.tryCatch(
    () =>
      deps.loginUserEventQueue.sendMessage(base64EncodeObject(revokeMessage)),
    E.toError,
  );
};
