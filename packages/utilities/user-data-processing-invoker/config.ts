import { get } from "http";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { withDefault } from "@pagopa/ts-commons/lib/types";
import * as t from "io-ts";
import { getConfigOrThrow } from "./env";

export const Config = t.type({
  apiUrl: NonEmptyString,
  apiKey: NonEmptyString,
  inputFilePath: withDefault(NonEmptyString, "users.txt" as NonEmptyString),
  invalidFiscalCodesFilePath: withDefault(
    NonEmptyString,
    "invalid_fiscal_codes.txt" as NonEmptyString,
  ),
  errorsFiscalCodesFilePath: withDefault(
    NonEmptyString,
    "errors_fiscal_codes.txt" as NonEmptyString,
  ),
});

export type Config = t.TypeOf<typeof Config>;
