import "dotenv/config";
import { createConfigLoader } from "./adapters/outbound/config-loader.js";
import { createApp } from "./app.js";

const start = async () => {
  // Load and validate configuration before creating the app.
  // If invalid, the process exits immediately with a clear error message.
  const configResult = createConfigLoader().load();

  if (configResult.isErr()) {
    console.error("Configuration loading failed:", configResult.error.message);
    process.exit(1);
  }

  const config = configResult.value;
  const { server } = createApp(config);

  try {
    await server.listen({ host: config.HOST, port: config.PORT });
    console.log(`Server listening on: http://${config.HOST}:${config.PORT}`);
    console.log(`Info: http://${config.HOST}:${config.PORT}/api/info`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
