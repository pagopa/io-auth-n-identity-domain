import { err, ok } from "neverthrow";
import type { ZodType } from "zod";

import { ConfigError } from "./config-error.js";
import type { ConfigLoader } from "./config-loader.js";


export const createEnvConfigLoader = <TConfig>(
  schema: ZodType<TConfig>,
): ConfigLoader<TConfig> => ({
  load() {
    const result = schema.safeParse(process.env);

    if (!result.success) {
      return err(new ConfigError(`Validation failed: ${result.error}`));
    }

    return ok(result.data);
  },
});
