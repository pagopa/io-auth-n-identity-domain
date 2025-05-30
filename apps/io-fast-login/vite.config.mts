import { defineConfig } from "vitest/config";
import { config } from "dotenv";

export default defineConfig({
  test: {
    coverage: {
      reporter: ["lcov", "text"],
      exclude: [
        "**/__mocks__/**",
        "*.js",
        "src/generated/**",
        "src/config.ts",
        "src/main.ts"],
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
