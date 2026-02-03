# io-session-manager

## 1.21.0

### Minor Changes

- d2116f3: Added fragment in redirection URL

## 1.20.1

### Patch Changes

- 8bcb20c: Updated libs

## 1.20.0

### Minor Changes

- 4bd9422: Migration Kit removal

## 1.19.0

### Minor Changes

- fdaa8bd: Migration Kit integration

## 1.18.0

### Minor Changes

- 678efc7: getUserIdentity moved to external api spec

## 1.17.0

### Minor Changes

- 5b14f99: Removed old basepath

## 1.16.1

### Patch Changes

- 88ab6fc: fix loginId valorization in rejected_login event emission

## 1.16.0

### Minor Changes

- 5b66dd1: Emit new serviceBus Event on Login Rejected

### Patch Changes

- Updated dependencies [5b66dd1]
  - @pagopa/io-auth-n-identity-commons@0.2.1

## 1.15.1

### Patch Changes

- 4059950: Update imports after @pagopa/io-auth-n-identity-commons refactoring
- Updated dependencies [01c4221]
- Updated dependencies [4059950]
  - @pagopa/io-auth-n-identity-commons@0.2.0

## 1.15.0

### Minor Changes

- 2529ee3: Redis client upgrade

## 1.14.2

### Patch Changes

- ec38bf0: Send RELOGIN Scenario in ServiceBus when an active session login is made

## 1.14.1

### Patch Changes

- 5dbcf8c: Remove FeatureFlag on session ServiceBus Events emission

## 1.14.0

### Minor Changes

- 8b744d1: Block "Active Session Login" when the FiscalCode included in SAMLResponse does not match the current one

## 1.13.0

### Minor Changes

- 340c327: Update acs with new 'isTestUser' check

## 1.12.0

### Minor Changes

- d22df37: Encrease the number of test users managed via environment variable, using a compressed string.

## 1.11.0

### Minor Changes

- 7c3f451: migrate from fn-profile SDK to generated client

## 1.10.0

### Minor Changes

- f7baa02: Added assertion_ref optional parameter to token introspect

## 1.9.2

### Patch Changes

- 8174913: Introduced metadata operation

## 1.9.1

### Patch Changes

- 2010846: Write an applicationInsights customEvent when emitting a logout serviceBus event fails

## 1.9.0

### Minor Changes

- e44be3a: Emit ServiceBus Logout event

## 1.8.0

### Minor Changes

- 444a2c5: New OpenAPI specs exposed

## 1.7.0

### Minor Changes

- 6c6cddb: Emit ServiceBus Login event

## 1.6.0

### Minor Changes

- 132b78e: Multiple mount for all endpoints

## 1.5.4

### Patch Changes

- baaaab2: Additional property on validation cookie custom event

## 1.5.3

### Patch Changes

- fc30d79: Introduced Validation Cookie

## 1.5.2

### Patch Changes

- 59f6ab7: Get session state fallback on standard login expiration date

## 1.5.1

### Patch Changes

- 4d9ee9a: Add optional property to user introspection API

## 1.5.0

### Minor Changes

- 45134bc: Add new API for sessionToken introspection

## 1.4.1

### Patch Changes

- c3297fb: Bumped io-spid-commons

## 1.4.0

### Minor Changes

- 21458e1: New field `expirationDate` in `GET /session` API

## 1.3.0

### Minor Changes

- 27bf1e1: Updated io-spid-commons dependency

## 1.2.0

### Minor Changes

- 933714e: Remove unused Feature Flag

## 1.1.0

### Minor Changes

- 8215c6b: Removed feature flags for well established features

## 1.0.0

### Major Changes

- 0bb548e: First major release of session-manager

## 0.16.1

### Patch Changes

- de16acd: Fix query parameter name

## 0.16.0

### Minor Changes

- 8d68265: Optimized getsession endpoint

## 0.15.3

### Patch Changes

- c8d4b78: Optimize fast-login call on errors

## 0.15.2

### Patch Changes

- 2e90192: Added missing Lollipop error events on generateLCParams call

## 0.15.1

### Patch Changes

- 1d9804f: Trace redis calls

## 0.15.0

### Minor Changes

- 17d200d: upgraded session-manager to node20

## 0.14.2

### Patch Changes

- de511ee: Fix Redis Client bug on reconnect when loosing conn

## 0.14.1

### Patch Changes

- e326185: Graceful shutdown with http req handling

## 0.14.0

### Minor Changes

- 8e7186d: Added appinsights event tracking on lollipop operations

## 0.13.1

### Patch Changes

- 0e0f144: Abortable fetch for downstream API

## 0.13.0

### Minor Changes

- 37533e7: Added whitelist for fims endpoints

## 0.12.2

### Patch Changes

- 5b24b65: Improve security of deploy pipeline

## 0.12.1

### Patch Changes

- 3fc6b9b: Fix dist folder

## 0.12.0

### Minor Changes

- ef4f6e3: Enable AppInsights

## 0.11.0

### Minor Changes

- 4538c5b: Test Login endpoint

## 0.10.0

### Minor Changes

- faab771: Added PagoPA user endpoint

## 0.9.0

### Minor Changes

- 3f489de: Add the acs endpoint for SPID/CIE login

## 0.8.1

### Patch Changes

- a718a81: fix: Try decode client ip from x-client-ip header

## 0.8.0

### Minor Changes

- c24842e: Expose logout endpoint

## 0.7.0

### Minor Changes

- 641d0e5: Added BPD user endpoint

## 0.6.1

### Patch Changes

- ae27de3: Enabled receivance of client IP

## 0.6.0

### Minor Changes

- 82f95df: Added zendesk token endpoint

## 0.5.1

### Patch Changes

- a7f427c: fix expressErrorMiddleware

## 0.5.0

### Minor Changes

- d7fdd85: Expose getLollipopUserForFims endpoint

## 0.4.1

### Patch Changes

- 20ffe6c: fix fnApp client basePath

## 0.4.0

### Minor Changes

- c7407c5: Expose getFimsToken endpoint

## 0.3.0

### Minor Changes

- 2298397: Migrated fast-login endpoint

## 0.2.0

### Minor Changes

- 276382a: Add SPID/CIE Login endpoint and config

## 0.1.0

### Minor Changes

- 8d167cb: Added fast-login generate-nonce endpoint

## 0.0.2

### Patch Changes

- 340fdf4: Add Unit test for getSession API
