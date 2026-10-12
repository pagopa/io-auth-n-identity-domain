import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      exclude: [
        "dist",
        "node_modules",
        "**/__mocks__/**",
        "**/__integrations__/**",
        "*.js",
      ],
      reporter: ["lcov", "text"],
    },
    exclude: ["**/node_modules/**", "**/dist/**", "**/__integrations__/**"],
  },
});
