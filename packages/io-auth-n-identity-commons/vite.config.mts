import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      exclude: [
        "dist",
        "/node_modules",
        "*.js",
        "src/**/index.ts",
        "src/**/dependency.ts",
      ],
      reporter: ["lcov", "text"],
    },
    exclude: ["**/node_modules/**", "**/dist/**"],
  },
});
