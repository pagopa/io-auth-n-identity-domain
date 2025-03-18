import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      exclude: ["dist", "/node_modules", "**/__integrations__", "src/generated/**",".eslintrc.js"],
      reporter: ["lcov", "text"]
    },
    exclude: ["**/node_modules/**", "**/dist/**", "**/__integrations__/**"]
  }
});
