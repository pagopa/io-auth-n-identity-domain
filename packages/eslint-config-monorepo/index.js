const { resolve } = require("node:path");

const project = resolve(process.cwd(), "tsconfig.json");

/** @type {import("eslint").Linter.Config} */
module.exports = {
  parser: "@typescript-eslint/parser",
  extends: [
    "eslint:recommended", 
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking",
    "prettier", 
    "eslint-config-turbo"
  ],
  plugins: ["@typescript-eslint", "only-warn"],
  parserOptions: {
    project: true,
  },
  globals: {
    React: true,
    JSX: true,
  },
  env: {
    node: true,
  },
  settings: {
    "import/resolver": {
      typescript: {
        project,
      },
    },
  },
  ignorePatterns: [
    "node_modules",
    "generated",
    "**/__tests__/*",
    "**/__mocks__/*",
    "**/__integrations__/*",
    "*.d.ts",
    "*.js"
  ],
  overrides: [
    {
      files: ["*.js?(x)", "*.ts?(x)"],
    },
  ],
  rules: {
    "@typescript-eslint/no-unused-expressions": "error",
    "@typescript-eslint/no-unused-vars": ["error", { args: "after-used" }],
    "arrow-body-style": "error",
    "complexity": "error",
    "eqeqeq": ["error", "smart"],
    "guard-for-in": "error",
    "max-lines-per-function": ["error", 200],
    "no-bitwise": "error",
    "no-console": "error",
    "no-eval": "error",
    "no-new-wrappers": "error",
    "no-param-reassign": "error",
    "no-undef-init": "error",
    "no-var": "error",
    "prefer-const": "error",
    "radix": "error",
  },
};
