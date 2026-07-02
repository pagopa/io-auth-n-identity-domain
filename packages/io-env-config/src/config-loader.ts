import type { Result } from "neverthrow";

import type { ConfigError } from "./config-error.js";

export interface ConfigLoader<TConfig> {
  load(): Result<TConfig, ConfigError>;
}
