import {
  createEnvConfigLoader,
  type ConfigLoader,
} from "@pagopa/io-env-config";

import { type z } from "zod";

export const createConfigLoader = <TOutput>(
  configSchema: z.ZodType<TOutput>,
): ConfigLoader<TOutput> => createEnvConfigLoader(configSchema);
