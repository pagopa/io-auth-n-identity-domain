import { defineConfig } from "vitest/config";
import { config } from "dotenv";

export default defineConfig({
  test: {
    coverage: {
      reporter: ["lcov", "text"],
      exclude: [
        "dist",
        "/node_modules",
        "*.js",
        "src/generated/**",
        "src/**/index.ts",
        "**/__mocks__",
        "vite.config.mts",
      ],
    },
    env: {
      ...config({ path: "env.example" }).parsed,
    },
    // typecheck: {
    //  enabled: true,
    //  tsconfig: "tsconfig.eslint.json",
    //  include: ["**/*.spec.ts"],
    // },
  },
});
