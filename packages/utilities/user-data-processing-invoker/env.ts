import { readableReportSimplified } from "@pagopa/ts-commons/lib/reporters";
import { pipe } from "fp-ts/lib/function";
import * as E from "fp-ts/lib/Either";
import * as t from "io-ts";
import { EnvConfig } from "./types";

export const envConfig = {
  ...process.env,
  apiUrl: process.env.API_URL,
  apiKey: process.env.API_KEY,
  dryRun: process.env.DRY_RUN === "true" || process.env.DRY_RUN === "1",
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
