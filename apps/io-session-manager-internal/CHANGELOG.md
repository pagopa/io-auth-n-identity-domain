# io-session-manager-internal

## 0.11.2

### Patch Changes

- b92f68a: Remove ServiceBus event emission feature flag

## 0.11.1

### Patch Changes

- 2010846: Write an applicationInsights customEvent when emitting a logout serviceBus event fails

## 0.11.0

### Minor Changes

- 4bb3d46: Emit logout event for AUTH_LOCK scenario
- bfc4940: emit logout event for ACCOUNT_REMOVAL scenario

## 0.10.0

### Minor Changes

- b54352b: Update web logout event with scenario and timestamp

### Patch Changes

- Updated dependencies [b54352b]
  - @pagopa/io-auth-n-identity-commons@0.1.0

## 0.9.0

### Minor Changes

- 2095786: Emit logout event from io-web successful logout

### Patch Changes

- Updated dependencies [5a529d0]
  - @pagopa/io-auth-n-identity-commons@0.0.3

## 0.8.1

### Patch Changes

- 12cad28: Removed optional token authentication

## 0.8.0

### Minor Changes

- f895c13: GetUserSessionState endpoint

## 0.7.0

### Minor Changes

- 673e6f9: Added DeleteUserSession endpoint

## 0.6.0

### Minor Changes

- d902890: Added Release Auth Lock endpoint

## 0.5.0

### Minor Changes

- e1ab55b: Expose `lockUserSession` endpoint

## 0.4.0

### Minor Changes

- a8e0ba9: Expose `unlockUserSession` endpoint

## 0.3.0

### Minor Changes

- 4e6084a: Ported AuthLock endpoint from io-backend

## 0.2.0

### Minor Changes

- f69221d: Introduced GetSession endpoint

## 0.1.1

### Patch Changes

- 8ad70c2: Minor refactor

## 0.1.0

### Minor Changes

- cc16e6c: Add `io-session-manager-internal`
