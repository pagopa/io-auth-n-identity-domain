import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import * as t from "io-ts";

export const Config = t.type({
  apiUrl: NonEmptyString,
  apiKey: NonEmptyString,
  inputFilePath: NonEmptyString,
  invalidFiscalCodesFilePath: NonEmptyString,
  errorsFiscalCodesFilePath: NonEmptyString,
});

export type Config = t.TypeOf<typeof Config>;
