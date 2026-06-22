import type { UseCase } from "@pagopa/io-core-domain";
import type { ConfigError, ConfigLoader } from "@pagopa/io-env-config";

import type { Config } from "../../domain/entities/config.js";

export const loadConfigUseCase =
  (
    configLoader: ConfigLoader<Config>,
  ): UseCase<Record<string, never>, Config, ConfigError> =>
  async () =>
    configLoader.load();
