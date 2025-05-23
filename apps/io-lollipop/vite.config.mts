import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      exclude: ["dist",
      "*.js",
      "**/__mocks__",
      "src/utils/config.ts",
        "/node_modules",
        "**/__integrations__",
        "src/generated/**",
        "src/**/index.ts"],
      reporter: ["lcov", "text"]
    },
    exclude: ["**/node_modules/**", "**/dist/**", "**/__integrations__/**"]
  }
});
