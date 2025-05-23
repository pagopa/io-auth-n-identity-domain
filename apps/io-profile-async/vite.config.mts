import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      exclude: [
        "dist",
        "/node_modules",
        "**/__mocks__/**",
        "*.js",
        "src/config.ts",
        "src/main.ts"
      ],
      reporter: ["lcov", "text"]
    },
    exclude: ["**/node_modules/**", "**/dist/**"]
  }
});
