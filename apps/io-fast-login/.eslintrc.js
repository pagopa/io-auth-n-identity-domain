module.exports = {
    "env": {
        "es2021": true,
        "node": true
    },
    "ignorePatterns": [
        "node_modules",
        "**/generated",
        "**/__tests__/*",
        "**/__mocks__/*",
        "*.d.ts",
        "docker",
        "jest.config.js",
        "**/__integrations__/*",
        "*.yaml",
        "dist",
    ],
    "parser": "@typescript-eslint/parser",
    "parserOptions": {
        "project": "./tsconfig.eslint.json",
        "sourceType": "module",
        "tsconfigRootDir": __dirname,
    },
    "extends": [
        "eslint-config-monorepo/index.js",
    ],
    "rules": {
        "@typescript-eslint/consistent-type-definitions": ["error", "type"]
    }
}
