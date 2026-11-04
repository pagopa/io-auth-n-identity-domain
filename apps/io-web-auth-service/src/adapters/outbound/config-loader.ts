import {
  createEnvConfigLoader,
  type ConfigLoader,
} from "@pagopa/io-env-config";
import { type z } from "zod";

type Options = {
  environment?: Record<string, unknown>;
  mappings?: Record<string, string>;
};

export const createConfigLoader = <TOutput>(
  configSchema: z.ZodType<TOutput>,
  options?: Options,
): ConfigLoader<TOutput> =>
  createEnvConfigLoader(
    configSchema,
    options?.environment ?? process.env,
    options?.mappings,
  );