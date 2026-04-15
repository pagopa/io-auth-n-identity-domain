import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      exclude: [
        "dist",
        "/node_modules",
        "**/__integrations__",
        "**/__mocks__/**",
        "src/generated/**",
        ".eslintrc.js",
        "src/config.ts",
        "src/main.ts",
        "src/types/*.ts",
        ".eslintrc.js",
        "vite.config.mts",
      ],
      reporter: ["lcov", "text"],
    },
    exclude: ["**/node_modules/**", "**/dist/**", "**/__integrations__/**"],
  },
});
