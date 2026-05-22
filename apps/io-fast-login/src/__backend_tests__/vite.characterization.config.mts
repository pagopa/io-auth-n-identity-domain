import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      enabled: false
    },
    exclude: ["**/dist/**", "**/node_modules/**"],
    fileParallelism: false,
    globalSetup: ["src/__backend_tests__/global-setup.ts"],
    hookTimeout: 60_000,
    include: ["src/__backend_tests__/characterization/**/*.test.ts"],
    poolOptions: {
      threads: {
        singleThread: true
      }
    },
    testTimeout: 60_000
  }
});
