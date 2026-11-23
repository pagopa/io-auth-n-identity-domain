# io-web-auth-service

## 0.5.0

### Minor Changes

- 81806d3: Add the `GET /login` endpoint that starts the OneIdentity OIDC flow. It accepts `min_auth_level` (SpidL1/L2/L3), `idp`, and optional `env` (default `PROD`) as query parameters, stores the login auxiliary data on Redis, tracks E2E login events, and redirects to the OneIdentity authorization endpoint.

  Add an optional `onError` listener to the Redis cluster client factories, registered before connecting.

### Patch Changes

- Updated dependencies [81806d3]
  - @pagopa/redis@0.5.0

## 0.4.1

### Patch Changes

- Updated dependencies [6c4c99c]
  - @pagopa/io-auth-n-identity-domain@0.7.0

## 0.4.0

### Minor Changes

- 6b65a4d: Add Azure Monitor and OpenTelemetry lifecycle logging with severity mapping, exception stacks, and bounded telemetry flushing on shutdown.

## 0.3.0

### Minor Changes

- 1c02924: Added io-web-auth-service healthcheck endpoints

## 0.2.0

### Minor Changes

- defb16a: Setup new io-web-auth-service
