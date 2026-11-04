import { type PackageInfo } from "@pagopa/io-package-info";
import fastify, { type FastifyInstance } from "fastify";

import { type Config } from "./domain/value-objects/configs/index.js";

export const createApp = async (
  _config: Config,
  _packageInfo: PackageInfo,
): Promise<{ server: FastifyInstance }> => {
  const server = fastify({ trustProxy: true });

  return { server };
};
