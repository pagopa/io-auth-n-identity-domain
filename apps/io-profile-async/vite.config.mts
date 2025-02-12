import { defineConfig } from "vitest/config.js";

export default defineConfig({
  test: {
    coverage: {
      exclude: ["dist", "/node_modules"],
      reporter: ["lcov", "text"]
    },
    exclude: ["**/node_modules/**", "**/dist/**"]
  }
});
