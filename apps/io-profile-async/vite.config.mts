import { defineConfig } from "vitest/config";
import { config } from "dotenv";

export default defineConfig({
  test: {
    coverage: {
      exclude: ["dist", "/node_modules", "**/__mocks__/**", "*.js"],
      reporter: ["lcov", "text"]
    },
    env: {
      ...config({ path: "env.example" }).parsed
    },
    exclude: ["**/node_modules/**", "**/dist/**"]
  }
});
