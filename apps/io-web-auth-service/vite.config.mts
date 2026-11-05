import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/__tests__/*.test.ts"],
    coverage: {
      include: ["src/**/*.ts"],
      exclude: ["src/**/__tests__/**"],
      reporter: ["lcov", "text"],
    },
    exclude: ["**/node_modules/**", "**/dist/**"],
  },
});
