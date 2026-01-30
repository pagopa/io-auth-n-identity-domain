# Plan: Migrate from Yarn/NPM to pnpm

Migrate the monorepo from pnpm or pnpm to pnpm. This migration enforces strict dependency management by fixing ghost dependencies individually, updating Dockerfiles, and migrating GitHub Actions.

## Constraints

- Do not commit any changes to git without explicit instruction.
- Prefer `pnpm add` / `pnpm add -D` when adding dependencies to preserve lockfile integrity.
- never use `pnpm@latest`, always try to use the same version as specified in the root `package.json` file using `corepack` without version.

## Steps

### Upgrade NodeJS

Only in case the node version in `.node-version` is less than 20.19.5, upgrade Node.js to version 20.20.0. Search all project files for version references and ensure the correct runtime is installed if it is not already present.

Before proceeding, ensure that a NodeJS version >= 20.19.5 is installed and used across the monorepo. Run `node -v` to verify.

### Install pnpm >= v10.28.1

1. Add `.pnpm-store` to .gitignore if not present.

2. Run `pnpm dlx --yes @pagopa/dx-cli codemod apply use-pnpm` and wait for it to complete. IMPORTANT: do not skip this step. If codemod fails, stop immediately and report the issue with the error message.

This will install `pnpm` and create a `pnpm-lock.yaml` file at the root of the monorepo.

### Update Dockerfiles

Modify all Dockerfiles to install `pnpm` (same version as in root `package.json` using corepack when possible) and use `pnpm dlx turbo` and `pnpm install --frozen-lockfile`. Prefer to use `corepack` (without version) to install pnpm instead of installing it via npm: pnpm version is specified in the root package.json file.

Check `docker-compose.yaml` files for any references to `yarn` and update them to use `pnpm` accordingly.

### Update CI/CD Workflows

Update workflows in .github/workflows/ to use `pnpm` using corepack, set `cache: "pnpm"`, and replace `yarn` commands.
Prefer to use `corepack` (without version) to install pnpm instead of installing it via npm: pnpm version is specified in the root `package.json` file.

Ensure that the `cache-dependency-path` in GitHub Actions points to pnpm-lock.yaml to ensure reliable caching after the migration.

### Fix Ghost Dependencies

Execute `pnpm install` and `pnpm -r build`. For every "module not found" error, explicitly add the missing dependency until all builds succeed without using `public-hoist-pattern`.

Peer Dependency Issues: `pnpm` is strict about peer dependencies; some packages might require `pnpm.peerDependencyRules` in the root package.json if upstream packages have poorly defined peers.

### Clean Up

Remove any remaining references to `yarn` in .gitignore

### Minor Fixes

Upgrade vscode settings and all README.md to reflect changes.

### Dependency Check Removal

Remove `dependency-check` from devDependencies and eliminate any related build scripts in all `package.json` files.

### Finishing Up

**IMPORTANT**: once done, run `pnpm build` and `pnpm code-review` at the root of the monorepo and fix any issues until everything pass successfully across the monorepo. Do not skip this step and ensure all tests are green.
