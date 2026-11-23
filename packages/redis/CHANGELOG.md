# @pagopa/redis

## 0.5.0

### Minor Changes

- 81806d3: Add the `GET /login` endpoint that starts the OneIdentity OIDC flow. It accepts `min_auth_level` (SpidL1/L2/L3), `idp`, and optional `env` (default `PROD`) as query parameters, stores the login auxiliary data on Redis, tracks E2E login events, and redirects to the OneIdentity authorization endpoint.

  Add an optional `onError` listener to the Redis cluster client factories, registered before connecting.

## 0.4.1

### Patch Changes

- 28a0d26: Add app lifecycle cleanup and tests

## 0.4.0

### Minor Changes

- bc89b97: Add optional SET options on `RedisObjectWrapper.save` and `getAndDelete`

## 0.3.0

### Minor Changes

- e9f6f07: Added capability to instantiate a redis cluster

## 0.2.0

### Minor Changes

- 6993b6a: Added redis object wrapper

## 0.1.0

### Minor Changes

- 583dc03: RedisSetWrapper and Single Node Client factory
