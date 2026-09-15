---
"io-session-manager-oi": patch
---

Strip the SPID/CIE `TINIT-` prefix from OIDC `fiscalNumber` claims so CIE Collaudo login no longer fails with invalid claims (IOPID-4203).
