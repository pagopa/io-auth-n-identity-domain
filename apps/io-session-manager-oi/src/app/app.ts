import { type PackageInfo } from "@pagopa/io-package-info";
import { type FastifyInstance } from "fastify";

import { type Config } from "../domain/value-objects/configs/index.js";

import { createDevelopmentApp } from "./development.js";
import { createProductionApp } from "./production.js";

export const createApp = async (
  config: Config,
  packageInfo: PackageInfo,
): Promise<{
  server: FastifyInstance;
}> => {
  const { server } =
    config.NODE_ENV === "production"
      ? await createProductionApp(config, packageInfo)
      : await createDevelopmentApp(config, packageInfo);

  return { server };
};
