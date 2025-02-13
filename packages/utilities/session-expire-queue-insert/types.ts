import { FiscalCode, NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { withDefault } from "@pagopa/ts-commons/lib/types";
import * as t from "io-ts";

export const Config = t.type({
  storageConnString: NonEmptyString,
  queueName: NonEmptyString,
  applicationInsightsConnString: NonEmptyString,
  timeoutMultiplier: t.number,
  singleBatchCount: t.number,
  inputFilePath: withDefault(NonEmptyString, "users.txt" as NonEmptyString),
  errorFilePath: withDefault(NonEmptyString, "errors.txt" as NonEmptyString),
});

export type Config = t.TypeOf<typeof Config>;

export const ItemToEnqueue = t.type({
  payload: t.type({
    fiscalCode: FiscalCode,
  }),
  itemTimeoutInSeconds: t.number,
});

export type ItemToEnqueue = t.TypeOf<typeof ItemToEnqueue>;
