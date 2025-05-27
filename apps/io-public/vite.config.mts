import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      exclude: [
        "dist",
        "/node_modules",
        "*.js",
        "src/generated/**",
        "src/**/index.ts",
        "src/utils/config.ts",
        "**/__mocks__"
      ],
      reporter: ["lcov", "text"]
    },
    exclude: ["**/node_modules/**", "**/dist/**"]
  }
});
