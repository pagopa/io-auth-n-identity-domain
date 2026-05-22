import { config } from "dotenv";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      enabled: false,
    },
    env: {
      ...config({ path: "env.example" }).parsed,
      DEV_SERVICE_BUS_CONNECTION_STRING:
        "Endpoint=sb://stub.local;SharedAccessKeyName=stub;SharedAccessKey=stub;UseDevelopmentEmulator=true;",
      LOLLIPOP_API_BASE_PATH: "",
      NODE_ENV: "development",
      PLATFORM_PROXY_API_URL: "http://127.0.0.1:0",
    },
    exclude: ["**/dist/**", "**/node_modules/**"],
    fileParallelism: false,
    hookTimeout: 30_000,
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
    testTimeout: 30_000,
  },
});
