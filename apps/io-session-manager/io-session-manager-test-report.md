# io-session-manager backend test report

## Scope

- **Path:** `both`
- **Boundary:** the real Express app created by `src/app.ts`, driven through HTTP requests with `supertest`
- **Entrypoints:** `src/__backend__/vite.config.mts`, `src/__backend__/support/runtime.ts`

## Shared harness

| Concern | Implementation |
| --- | --- |
| App runtime | `src/__backend__/support/runtime.ts` boots `newApp({})` and reuses it per suite |
| Redis dependency | `src/__backend__/support/fake-redis.ts` provides an in-memory fallback that mimics the Redis cluster surface the selected scenarios need |
| Partner HTTP dependencies | `src/__backend__/support/stub-server.ts` exposes local stubs for io-profile, fast-login, and lollipop |
| Platform internal cachedel | `src/__backend__/support/runtime.ts` records `deleteSession` calls through an in-memory client stub |
| Queue / broker side effects | In-memory recorders capture lollipop revoke queue messages and auth-session topic messages |
| SPID bootstrap | The harness stubs SPID runtime bootstrap because the selected scenarios do not exercise SPID login routes directly |

## Why Redis is a fallback instead of Testcontainers

The app uses a Redis **cluster** client. A probe against the workspace topology showed that external test processes do not get an honest, stable cluster discovery path without extra network rewriting, so this harness keeps the HTTP runtime honest and uses an explicit in-memory Redis fallback for the selected scenarios instead of pretending a broken cluster is integrated.

## Scenario inventory

| Scenario | Suite | Boundary exercised | Observable outcome | Infrastructure used |
| --- | --- | --- | --- | --- |
| Healthcheck happy path | `src/__backend__/integration/healthcheck.spec.ts` | `GET /api/auth/v1/healthcheck` | `200` with backend version | Express app + Redis fallback |
| Session state happy path | `src/__backend__/integration/session.spec.ts` | `GET /api/auth/v1/session` with bearer auth | session payload + io-profile lookup | Express app + Redis fallback + io-profile stub |
| Logout happy path | `src/__backend__/integration/logout.spec.ts` | `POST /api/auth/v1/logout` with bearer auth | session deletion + platform delete + queue/topic emissions | Express app + Redis fallback + platform recorder + in-memory queue/topic recorders |
| Fast-login characterization | `src/__backend__/record-replay/fast-login.spec.ts` | `POST /api/auth/v1/fast-login` | recorded response plus Redis/session and outbound side effects | Express app + Redis fallback + lollipop/fast-login stubs + platform recorder |
| Logout characterization | `src/__backend__/record-replay/logout.spec.ts` | `POST /api/auth/v1/logout` | recorded response plus deletion and emitted side effects | Express app + Redis fallback + platform recorder + in-memory queue/topic recorders |

## Record-replay cassettes

| Scenario | Cassette directory |
| --- | --- |
| Fast-login happy path | `src/__backend__/record-replay/cassettes/fast-login-happy-path/` |
| Logout app flow | `src/__backend__/record-replay/cassettes/logout-app-flow/` |

## Rerun commands

```sh
pnpm --filter io-session-manager test:backend:integration
pnpm --filter io-session-manager test:backend:verify
pnpm --filter io-session-manager test:backend:record
pnpm --filter io-session-manager test:backend
```

## Current intentional gaps

- The harness does **not** attempt a live Redis cluster, Azurite, or Service Bus emulator yet; it captures the selected contracts with deterministic local fallbacks instead.
- SPID login and metadata refresh flows remain covered by the existing unit tests, not by this backend harness.
