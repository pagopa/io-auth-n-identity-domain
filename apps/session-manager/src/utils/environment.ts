import { log } from "./logger";

/**
 * Get a required value reading from the environment.
 * The process will be killed with exit code 1 if the env var is not provided
 *
 * @param {string} envName
 * @param {string} valueName
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
