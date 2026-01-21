module.exports = {
    root: true,
    env: {
        es2021: true,
        node: true
      },
      ignorePatterns: [
        "*.yaml",
        "src/generated/**/*",
        "dist/**/*",
      ],
      parserOptions: {
        project: "./tsconfig.eslint.json",
        tsconfigRootDir: __dirname,
      },
    extends: [
        "eslint-config-monorepo/index.js",
    ],
    rules: {
        "@typescript-eslint/consistent-type-definitions": ["error", "type"]
    }
}
