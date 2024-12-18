import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    poolOptions: {
      threads: { singleThread: true }
    },
    coverage: {
      enabled: false
    },
    exclude: ["**/node_modules/**", "**/dist/**"]
  }
});
