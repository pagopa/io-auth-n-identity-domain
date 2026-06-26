import {
  createEnvConfigLoader,
  type ConfigLoader,
} from "@pagopa/io-env-config";

import {
  ConfigSchema,
  type Config,
} from "../../domain/entities/config.entity.js";

export const createConfigLoader = (): ConfigLoader<Config> =>
  createEnvConfigLoader(ConfigSchema);
