import { err, ok } from "neverthrow";
import type { ZodType } from "zod";

import { ConfigError } from "./config-error.js";
import type { ConfigLoader } from "./config-loader.js";

/**
 * Creates an environment-based configuration loader.
 *
 * @param schema - Zod schema for configuration validation.
 * @param environment - Optional environment object to use instead of process.env.
 * @param mappings - Optional mapping of configuration keys to environment variables.
 * @returns A configuration loader.
 */
export const createEnvConfigLoader = <TConfig>(
  schema: ZodType<TConfig>,
  environment: Record<string, unknown> = process.env,
  mappings?: Record<string, string>,
): ConfigLoader<TConfig> => ({
  load() {
    const configEnvironment = { ...environment };

    if (mappings) {
      for (const [key, value] of Object.entries(mappings)) {
        if (configEnvironment[value] !== undefined) {
          configEnvironment[key] = configEnvironment[value];
        }
      }
    }

    const result = schema.safeParse(configEnvironment);

    if (!result.success) {
      return err(new ConfigError(`Validation failed: ${result.error}`));
    }

    return ok(result.data);
  },
});
