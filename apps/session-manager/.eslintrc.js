/** @type {import("eslint").Linter.Config} */
module.exports = {
  env: {
    es2021: true,
    node: true
  },
  extends: ["eslint-config-monorepo/index.js"],
  ignorePatterns: [
    "*.yaml",
    "**/*.test.ts",
    "src/generated/**/*",
    "dist/**/*",
  ],
  rules: {
    "max-classes-per-file": "off",
  }
};