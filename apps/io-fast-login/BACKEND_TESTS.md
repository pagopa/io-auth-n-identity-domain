# io-fast-login backend tests

## Boundary and topology

- **Boundary:** real local Azure Functions host started with `func start`
- **Shared local dependencies:** Redis and Azurite via Testcontainers
- **Local stub:** a deterministic HTTP Lollipop stub for `/assertions/:assertion_ref`
- **Auth setup:** function-level routes use a pre-seeded file-based host key in `Secrets/host.json`

## Coverage

- **Integration**
  - `generate-nonce` happy path: stores the generated nonce in Redis with a live TTL
  - `fast-login` happy path: returns the SAML response, deletes the nonce, writes the audit blob, and calls the Lollipop dependency
- **Record-replay**
  - `fast-login` happy path: freezes the HTTP contract, outbound Lollipop request, audit blob payload, and nonce deletion outcome

## Layout

```text
src/__backend_tests__/
  global-setup.ts
  support/
    azurite.ts
    cassettes.ts
    fixtures.ts
    function-host.ts
    lollipop-stub.ts
    redis.ts
    scenarios.ts
    shared-harness.ts
    with-test-fixtures.ts
  integration/
    generate-nonce.happy-path.test.ts
    fast-login.happy-path.test.ts
  characterization/
    fast-login.happy-path.test.ts
    cassettes/
      fast-login-happy-path/
```

## Commands

- `pnpm --dir apps/io-fast-login test:backend:integration`
- `pnpm --dir apps/io-fast-login test:backend:record`
- `pnpm --dir apps/io-fast-login test:backend:verify`

## Re-entry notes

- Keep the shared support layer as the single owner of Redis, Azurite, host startup, and cassette helpers.
- New fast-login scenarios should reuse the same Lollipop stub and normalization rules unless the contract boundary changes.
- New session-manager scenarios can reuse the same host/runtime support and add a second local HTTP stub instead of rebuilding the harness.
