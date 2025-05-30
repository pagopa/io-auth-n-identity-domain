import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      exclude: [
        "dist",
        "/node_modules",
        "**/__mocks__/**",
        "*.js",
        "src/generated/**",
        "src/config.ts",
        "src/main.ts",
        "src/**/index.ts",
        "src/**/dependency.ts"
      ],
      reporter: ["lcov", "text"]
    },
    exclude: ["**/node_modules/**", "**/dist/**"]
  }
});
