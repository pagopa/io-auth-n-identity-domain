# io-session-manager-oi

## 0.14.1

### Patch Changes

- d877819: added a shared BASE_PATH constant used by both route handlers and openapi-generator and apply linting fixes

## 0.14.0

### Minor Changes

- e463af5: Adds generated OpenAPI

## 0.13.0

### Minor Changes

- 926424f: add auth event Port and Adapter to send events via Service Bus

### Patch Changes

- Updated dependencies [926424f]
  - @pagopa/io-auth-n-identity-session@0.3.0
  - @pagopa/io-auth-n-identity-domain@0.5.0

## 0.12.0

### Minor Changes

- e9f6f07: Added capability to instantiate a redis cluster

### Patch Changes

- Updated dependencies [e9f6f07]
  - @pagopa/redis@0.3.0

## 0.11.1

### Patch Changes

- 6c98116: fix ausiliar data log error message

## 0.11.0

### Minor Changes

- 29c4d81: Add OIDC Callback endpoint

## 0.10.0

### Minor Changes

- 04f1496: Upgrade hexagonal libraries + workaround for branded schema
- df6e21c: Updated sm-internal client to upstream spec

### Patch Changes

- 5e3d5c4: Refactor config
- Updated dependencies [04f1496]
  - @pagopa/io-auth-n-identity-domain@0.4.0
  - @pagopa/io-auth-n-identity-session@0.2.2

## 0.9.0

### Minor Changes

- 6993b6a: Added Reserve endpoint

### Patch Changes

- Updated dependencies [6993b6a]
- Updated dependencies [6993b6a]
  - @pagopa/io-auth-n-identity-domain@0.3.1
  - @pagopa/redis@0.2.0
  - @pagopa/io-auth-n-identity-session@0.2.1

## 0.8.0

### Minor Changes

- cb0227a: Introduce activate user session use-case (base logic)

### Patch Changes

- Updated dependencies [cb0227a]
  - @pagopa/io-auth-n-identity-session@0.2.0

## 0.7.0

### Minor Changes

- edd2800: Switch to Azure Managed Redis instance with Managed Identity auth

## 0.6.0

### Minor Changes

- 583dc03: BlockedUsersPort and BlockedUsersRedisAdapter

### Patch Changes

- Updated dependencies [583dc03]
  - @pagopa/redis@0.1.0

## 0.5.0

### Minor Changes

- 37125b6: add NotificationOutboundPort and its adapter

## 0.4.0

### Minor Changes

- cb26d6b: split healthchecks into readiness and liveness probes

## 0.3.0

### Minor Changes

- c683e15: Added sm-internal-rollout port and adapter
- d352687: Add Locked Profiles outbound adapter
- a3672f0: Added fn fast-login port and adapter

### Patch Changes

- Updated dependencies [d352687]
- Updated dependencies [a3672f0]
  - @pagopa/azure-sdk@0.1.0
  - @pagopa/io-auth-n-identity-domain@0.3.0

## 0.2.0

### Minor Changes

- 5ad200f: Added io-lollipop client port and adapter

## 0.1.1

### Patch Changes

- e80de12: Specify `.js` extension in generated files
- Updated dependencies [1301a44]
  - @pagopa/io-auth-n-identity-domain@0.2.0

## 0.1.0

### Minor Changes

- 7357cea: First release of IO Session Manager OneIdentity

### Patch Changes

- Updated dependencies [7357cea]
  - @pagopa/io-auth-n-identity-domain@0.1.0
  - @pagopa/io-package-info@0.1.0
  - @pagopa/io-env-config@0.1.0
