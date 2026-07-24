import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Run integration tests serially to avoid stepping on the same Azurite
    // table from parallel workers.
    fileParallelism: false,
    poolOptions: {
      threads: { singleThread: true },
    },
    coverage: {
      enabled: false,
    },
    exclude: ["**/node_modules/**", "**/dist/**"],
    testTimeout: 20_000,
  },
});
