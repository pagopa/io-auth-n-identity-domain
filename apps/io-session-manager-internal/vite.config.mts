import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      exclude: [
        "dist",
        "/node_modules",
        "**/__integrations__",
        "*.js",
        "**/generated",
        "src/controllers/main.ts",
        "src/utils/config.ts",
      ],
      reporter: ["lcov", "text"],
    },
    exclude: ["**/node_modules/**", "**/dist/**", "**/__integrations__/**"],
  },
});
