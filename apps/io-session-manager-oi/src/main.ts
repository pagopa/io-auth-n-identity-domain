import "dotenv/config";

import { createPackageInfoAdapter } from "@pagopa/io-package-info";

import { createConfigLoader } from "./adapters/outbound/config-loader.js";
import { createApp } from "./app.js";
import { ConfigSchema } from "./domain/entities/config.entity.js";

const start = async () => {
  const configResult = createConfigLoader(ConfigSchema).load();
  if (configResult.isErr()) {
    console.error("Failed to load configuration:", configResult.error);
    process.exit(1);
  }

  const config = configResult.value;

  const packageInfoResult = createPackageInfoAdapter(
    new URL("../package.json", import.meta.url).pathname,
  ).load();
  if (packageInfoResult.isErr()) {
    console.error("Failed to load package info:", packageInfoResult.error);
    process.exit(1);
  }

  const { server } = createApp(config, packageInfoResult.value);

  try {
    await server.listen({
      host: config.HOST,
      port: config.PORT,
    });
    console.log(`Server listening on: http://${config.HOST}:${config.PORT}`);
    console.log(
      `Info: http://${config.HOST}:${config.PORT}/api/auth/v2/healthcheck`,
    );
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

await start();
