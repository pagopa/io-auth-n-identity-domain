import "dotenv/config";

import {
  ConfigSchema,
  ServerConfigSchema,
} from "./domain/entities/config.entity.js";
import { createConfigLoader } from "./adapters/outbound/config-loader.js";
import { createApp } from "./app.js";

const start = async () => {
  // Try loading the server configuration first,
  // since it is needed to start the server.
  const serverConfigResult = createConfigLoader(ServerConfigSchema).load();
  if (serverConfigResult.isErr()) {
    console.error(
      "Failed to load server configuration:",
      serverConfigResult.error,
    );
    process.exit(1);
  }

  const serverConfig = serverConfigResult.value;

  const { server } = createApp(createConfigLoader(ConfigSchema).load());

  try {
    await server.listen({
      host: serverConfig.HOST,
      port: serverConfig.PORT,
    });
    console.log(
      `Server listening on: http://${serverConfig.HOST}:${serverConfig.PORT}`,
    );
    console.log(
      `Info: http://${serverConfig.HOST}:${serverConfig.PORT}/api/info`,
    );
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
