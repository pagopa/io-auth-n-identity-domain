import { NumberFromString } from "@pagopa/ts-commons/lib/numbers";
import { FiscalCode, NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import * as t from "io-ts";

export const Config = t.type({
  originStorageConnectionString: NonEmptyString,
  originTableName: NonEmptyString,
  destinationStorageConnectionString: NonEmptyString,
  destinationTableName: NonEmptyString,
});

export type Config = t.TypeOf<typeof Config>;

export const LockedProfile = t.type({
  partitionKey: FiscalCode,
  rowKey: NonEmptyString,
  createdAt: NumberFromString,
  released: t.union([t.boolean, t.undefined]),
});

export type LockedProfile = t.TypeOf<typeof LockedProfile>;
