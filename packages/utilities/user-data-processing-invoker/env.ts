import { readableReportSimplified } from "@pagopa/ts-commons/lib/reporters";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { pipe } from "fp-ts/lib/function";
import * as E from "fp-ts/lib/Either";
import * as t from "io-ts";

export type EnvConfig = t.TypeOf<typeof EnvConfig>;
export const EnvConfig = t.type({
  API_URL: NonEmptyString,
  API_KEY: NonEmptyString,
});

export const envConfig = {
  ...process.env,
  API_URL: process.env.API_URL,
  API_KEY: process.env.API_KEY,
};

const errorOrConfig: t.Validation<EnvConfig> = EnvConfig.decode(envConfig);

/**
 * Read the application configuration and check for invalid values.
 * If the application is not valid, raises an exception.
 *
 * @returns the configuration values
 * @throws validation errors found while parsing the application configuration
 */
export const getConfigOrThrow = (): EnvConfig =>
  pipe(
    errorOrConfig,
    E.getOrElseW((errors: ReadonlyArray<t.ValidationError>) => {
      throw new Error(
        `Invalid configuration: ${readableReportSimplified(errors)}`,
      );
    }),
  );
