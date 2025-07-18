# io-profile-async

## 1.11.2

### Patch Changes

- 72c5d77: Handle 404 on delete for session-notifications model

## 1.11.1

### Patch Changes

- aedc7ad: Increase maxConcurrentSessions for serviceBusTrigger AZFN

## 1.11.0

### Minor Changes

- a3a9e4d: Date input support for timer trigger `ExpiredSessionsDiscoverer`

## 1.10.0

### Minor Changes

- 8dec30c: Adding SessionNotificationsInitRecovery, a QueueTrigger needed in order to recover sessions created previously the Auth ServiceBus events are activated.

## 1.9.0

### Minor Changes

- b54352b: Update dependency `io-authn-identity-commons`

### Patch Changes

- Updated dependencies [b54352b]
  - @pagopa/io-auth-n-identity-commons@0.1.0

## 1.8.0

### Minor Changes

- 5a529d0: Add SessionNotificationEventsProcessor ServiceBusTrigger function, responsible for handling session related events and session-notifications cosmosDB container management

### Patch Changes

- Updated dependencies [5a529d0]
  - @pagopa/io-auth-n-identity-commons@0.0.3

## 1.7.0

### Minor Changes

- cad3488: Update Internal client

## 1.6.0

### Minor Changes

- d000426: Add timer trigger `ExpiredSessionsDiscoverer`

## 1.5.0

### Minor Changes

- d19afc3: Move `StoreSpidLogs` function from `io-profile` to `io-profile-async`

## 1.4.0

### Minor Changes

- 9a6f85b: Added OnProfileUpdate cosmosDB trigger

## 1.3.0

### Minor Changes

- 2a126ca: Add expiration date in user re-engagement email

## 1.2.0

### Minor Changes

- 7e20167: Move `MigrateServicePreferenceFromLegacy` function from `io-profile` to `io-profile-async`

## 1.1.1

### Patch Changes

- 57dbe8c: Update ExpiredSessionAdvisor Queue Model (added expiredAt parameter).
  Avoid sending E-Mail to user who do not have a validated E-Mail Address

## 1.1.0

### Minor Changes

- 8f5f171: Enable dry-run mode for load testing

## 1.0.2

### Patch Changes

- ce42c39: Init telemetryClient on main

## 1.0.1

### Patch Changes

- 09aed9f: Fix AppInsights config

## 1.0.0

### Major Changes

- 0690bd2: Added ExpiredSessionAdvisor QueueTrigger AZF

## 0.1.0

### Minor Changes

- 41ca6fc: First version
