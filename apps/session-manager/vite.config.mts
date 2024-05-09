import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    reporters: [
      ["vitest-sonar-reporter", { outputFile: "coverage/sonar-report.xml" }],
    ],
    coverage: {
      reporter: ["lcov"],
    },
  },
});
