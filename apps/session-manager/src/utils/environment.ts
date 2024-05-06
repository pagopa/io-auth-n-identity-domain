import { log } from "./logger";

/**
 * Get a required value reading from the environment.
 * The process will be killed with exit code 1 if the env var is not provided
 *
 * @param envName the ENV variable name
 * @returns the value contained inside the env variables
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
