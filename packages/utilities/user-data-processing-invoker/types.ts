import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { withDefault } from "@pagopa/ts-commons/lib/types";
import * as E from "fp-ts/Either";
import * as t from "io-ts";

export const ApiUrlWithFiscalCode = new t.Type<string, string, unknown>(
  "ApiUrlWithFiscalCode",
  t.string.is,
  (u, c) =>
    E.chain((s: string) => {
      const matches = s.match(/{fiscalCode}/g) || [];
      return matches.length === 1
        ? E.right(s)
        : E.left([
            {
              value: u,
              context: c,
              message: "Must contain exactly one {fiscalCode}",
            },
          ]);
    })(
      E.mapLeft((errors: t.Errors) =>
        errors.map((e) => ({
          value: e.value,
          context: e.context,
          message: e.message ?? "Validation error",
        })),
      )(t.string.validate(u, c)),
    ),
  t.identity,
);

export type EnvConfig = t.TypeOf<typeof EnvConfig>;
export const EnvConfig = t.type({
  apiUrl: ApiUrlWithFiscalCode,
  apiKey: NonEmptyString,
  dryRun: withDefault(t.boolean, false),
});

export type CliParams = t.TypeOf<typeof CliParams>;
export const CliParams = t.type({
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
export const Config = t.intersection([EnvConfig, CliParams]);
