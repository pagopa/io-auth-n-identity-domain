---
"io-web-auth-service": minor
---

Add the `GET /login` endpoint that starts the OneIdentity OIDC flow. It accepts `min_auth_level` (SpidL1/L2/L3), `idp`, and optional `env` (default `PROD`) as query parameters, stores the login auxiliary data on Redis, tracks E2E login events, and redirects to the OneIdentity authorization endpoint.
