import type { UseCase } from "@pagopa/hexagonal-core";
import type { ConfigError, ConfigLoader } from "@pagopa/io-env-config";

import type { Config } from "../../domain/entities/config.entity.js";

export const loadConfigUseCase =
  (
    configLoader: ConfigLoader<Config>,
  ): UseCase<Record<string, never>, Config, ConfigError> =>
  () =>
    Promise.resolve(configLoader.load());
