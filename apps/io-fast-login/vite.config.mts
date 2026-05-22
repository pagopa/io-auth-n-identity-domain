import { defineConfig } from "vitest/config";
import { config } from "dotenv";

export default defineConfig({
  test: {
    coverage: {
      reporter: ["lcov", "text"],
      exclude: [
        "src/__backend_tests__/**",
        "**/__mocks__/**",
        "*.js",
        "src/generated/**",
        "src/config.ts",
        "src/main.ts"
      ]
    },
    exclude: ["**/dist/**", "**/node_modules/**", "src/__backend_tests__/**"],
    env: {
      ...config({ path: "env.example" }).parsed
    },
    // typecheck: {
    //  enabled: true,
    //  tsconfig: "tsconfig.eslint.json",
    //  include: ["**/*.spec.ts"],
    // },
  },
});
