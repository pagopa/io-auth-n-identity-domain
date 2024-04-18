require("@rushstack/eslint-patch/modern-module-resolution");

module.exports = {
  env: {
    es2021: true,
    node: true
  },
  extends: ["@pagopa/eslint-config/recommended"],
  ignorePatterns: [
    "*.yaml",
    "**/*.test.ts",
    "src/generated/**/*",
    "dist/**/*",
  ],
  rules: {
    "max-classes-per-file": "off",
  },
};