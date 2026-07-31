import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Only pick up files under `__integrations__/` — the default
    // `vitest run` script runs the unit tests, this config runs the
    // integration tests, and never the twain shall meet.
    include: ["**/__integrations__/**/*.integration.test.ts"],
    // Run integration tests serially so parallel workers don't step on
    // the same shared key in the cluster.
    fileParallelism: false,
    poolOptions: {
      threads: { singleThread: true },
    },
    coverage: {
      enabled: false,
    },
    exclude: ["**/node_modules/**", "**/dist/**"],
    // Cluster startup + slot discovery can take a few seconds on cold docker.
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
