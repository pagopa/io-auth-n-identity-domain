## `@pagopa/io-auth-n-identity-commons`

Shared modules, functions, and types for authentication and identity, used across multiple applications within the monorepo.

> This package is part of the monorepo and is intended to be used as an internal dependency to promote reuse and consistency across services.

## 📦 Contents

This package includes:
- Shared `io-ts` types.
- Reusable helpers.
- Common Repositories (eg. a Repo wich allow write events in a ServiceBus Topic).

## 📥 Installation (internal use within the monorepo)

If you're working in an application inside the monorepo (managed by [Turborepo](https://turbo.build/repo)), you can import this package as follows:

### Example `package.json`

```json
{
  "name": "my-app",
  "version": "1.0.0",
  "dependencies": {
    "@pagopa/io-auth-n-identity-commons": "*"
  }
}
```