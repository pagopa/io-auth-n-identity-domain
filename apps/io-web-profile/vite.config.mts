import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      exclude: [
        "dist",
        "/node_modules",
        "**/__integrations__",
        "src/generated/**",
        "src/**/index.ts",
        "**/__mocks__",
        "src/utils/config.ts"
      ],
      reporter: ["lcov", "text"]
    },
    exclude: ["**/node_modules/**", "**/dist/**", "**/__integrations__/**"]
  }
});
