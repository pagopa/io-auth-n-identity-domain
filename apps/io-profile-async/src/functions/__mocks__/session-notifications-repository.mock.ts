import { CosmosErrors } from "@pagopa/io-functions-commons/dist/src/utils/cosmosdb_model";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import * as E from "fp-ts/Either";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as t from "io-ts";
import { vi } from "vitest";
import { RetrievedSessionNotificationsStrict } from "../../types/session-notification-strict";
import { PermanentError } from "../../utils/errors";
import { TriggerDependencies } from "../session-notification-events-processor";

export const aFiscalCode = "AAAAAA89S20I111X" as FiscalCode;
export const anExpiredAt = new Date("2026-06-11T12:00:00Z");

export const validSessionNotifications: RetrievedSessionNotificationsStrict = {
  id: aFiscalCode,
  expiredAt: anExpiredAt.getTime(),
  notificationEvents: {},
  _etag: "etag",
  _rid: "rid",
  _self: "self",
  _ts: 123
};

export const afakeValidationError: t.ValidationError = {
  value: "some-invalid-value",
  context: [
    {
      key: "eventType",
      type: t.string,
      actual: validSessionNotifications
    }
  ],
  message: "Invalid eventType"
} as t.ValidationError;

export const anEmptyAsyncIterable = async function*() {
  yield [];
};

export const aSingleItemAsyncIterable = async function*() {
  yield [
    E.right(validSessionNotifications) as t.Validation<
      RetrievedSessionNotificationsStrict
    >
  ];
};

export const aSingleChuckAsyncIterable = async function*() {
  yield [
    E.right(validSessionNotifications),
    E.right({
      ...validSessionNotifications,
      expiredAt: validSessionNotifications.expiredAt - 1
    })
  ];
};

export const aMultiChuckAsyncIterable = async function*() {
  yield [E.right(validSessionNotifications)];
  yield [
    E.right({
      ...validSessionNotifications,
      expiredAt: validSessionNotifications.expiredAt - 1
    })
  ];
};

export const aSingleInvalidItemAsyncIterable = async function*() {
  yield [E.left([afakeValidationError])];
};

export const aMixedSingleChuckAsyncIterable = async function*() {
  yield [E.left([afakeValidationError]), E.right(validSessionNotifications)];
};

const deleteRecordMock = vi.fn(() =>
  RTE.of<TriggerDependencies, CosmosErrors, void>(void 0)
);
const createRecordMock = vi.fn(() =>
  RTE.of<TriggerDependencies, PermanentError | CosmosErrors, void>(void 0)
);

const findByFiscalCodeAsyncIterableMock = vi.fn(() => (_deps: unknown) =>
  aSingleItemAsyncIterable()
);

export const mockSessionNotificationsRepository = {
  findByFiscalCodeAsyncIterable: findByFiscalCodeAsyncIterableMock,
  deleteRecord: deleteRecordMock,
  createRecord: createRecordMock
};
