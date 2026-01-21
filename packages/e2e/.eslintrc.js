/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: true,
  env: {
    es2021: true,
    node: true
  },
  extends: ["eslint-config-monorepo/index.js"],
  parserOptions: {
    project: "./tsconfig.eslint.json",
    tsconfigRootDir: __dirname,
  },
  ignorePatterns: [
    "src/generated/**/*",
    "dist/**/*",
  ],
  rules: {
    "max-classes-per-file": "off",
  }
};