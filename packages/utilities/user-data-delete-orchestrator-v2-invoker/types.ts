import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { withDefault } from "@pagopa/ts-commons/lib/types";
import * as t from "io-ts";

export const Config = t.type({
  apiUrl: NonEmptyString,
  apiKey: NonEmptyString,
  inputFilePath: withDefault(NonEmptyString, "users.txt" as NonEmptyString),
  interval: withDefault(t.number, 100),
});

export type Config = t.TypeOf<typeof Config>;
