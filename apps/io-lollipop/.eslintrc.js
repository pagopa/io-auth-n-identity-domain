module.exports = {
  root: true,
  env: {
    es2021: true,
    node: true
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
  parserOptions: {
    project: "./tsconfig.eslint.json",
    tsconfigRootDir: __dirname,
  },
  extends: ["eslint-config-monorepo/index.js"],
  rules: {}
};
