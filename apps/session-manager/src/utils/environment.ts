import { pipe } from "fp-ts/lib/function";
import * as E from "fp-ts/Either";
import * as t from "io-ts";
import { log } from "./logger";

/**
 * Get a required value reading from the environment.
 * The process will be killed with exit code 1 if the env var is not provided
 *
 * @param envName the ENV variable name
 * @returns the value contained inside the env variables
 * @fires process exit in case the env is missing
 */
export function getRequiredENVVar(envName: string): string {
  const envVal = process.env[envName];
  if (envVal === undefined) {
    log.error("Missing %s required environment variable", envName);
    return process.exit(1);
  } else {
    return envVal;
  }
}

/**
 * Get a value reading from the environment, providing a default if not found or
 * null | undefined.
 *
 * @param envName - the ENV variable name
 * @param type - the io-ts decoder
 * @param fallback - default value for the wanted type
 * @returns value from environment or fallback
 */
export const getENVVarWithDefault = <T>(
  envName: string,
  type: t.Type<T>,
  fallback: T,
): T =>
  pipe(
    process.env[envName],
    type.decode,
    E.getOrElseW(() => fallback),
  );
