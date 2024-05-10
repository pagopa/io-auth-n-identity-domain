import { defineConfig } from "vitest/config";
import { config } from "dotenv";

export default defineConfig({
  test: {
    coverage: {
      reporter: ["lcov", "text"],
    },
    env: {
      ...config({ path: ".env" }).parsed,
    },
  },
});
