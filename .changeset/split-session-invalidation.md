---
"@pagopa/io-auth-n-identity-session": minor
"io-session-manager-oi": patch
---

Replace invalidatePreviousSession with a read-only findByFiscalCode lookup so proxy cache deletion happens before Cosmos session deletion.
