import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    poolOptions: {
      threads: { singleThread: true }
    },
    coverage: {
      exclude: ["dist", "/node_modules", "**/__integrations__"],
      reporter: ["lcov", "text"]
    },
    exclude: ["**/node_modules/**", "**/dist/**"]
  }
});
