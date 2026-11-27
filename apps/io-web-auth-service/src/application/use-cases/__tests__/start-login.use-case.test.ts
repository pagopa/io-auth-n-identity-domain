import { createHash } from "node:crypto";

import {
  GenericError,
  type NonEmptyString,
  ValidationError,
} from "@pagopa/hexagonal-core";
import { type IPString } from "@pagopa/io-auth-n-identity-domain";
import { err, ok } from "neverthrow";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  InvalidAuthorizationEndpointError,
  OidcDiscoveryError,
} from "../../../domain/errors/oidc.errors.js";
import { type AuxiliaryDataPort } from "../../../domain/ports/outbound/auxiliary-data.port.js";
import { type OidcConfigPort } from "../../../domain/ports/outbound/oidc-config.port.js";
import { type OidcClientPort } from "../../../domain/ports/outbound/oidc.port.js";
import {
  makeStartLoginUseCase,
  type StartLoginInput,
} from "../start-login.use-case.js";

const MOCKED_RANDOM_BYTES = "a".repeat(24);
const MOCKED_HEX = Buffer.from(MOCKED_RANDOM_BYTES).toString("hex");
vi.mock("node:crypto", async (importOriginal) => ({
  ...(await importOriginal<typeof import("node:crypto")>()),
  randomBytes: vi.fn(() => Buffer.from(MOCKED_RANDOM_BYTES)),
}));

const CLIENT_ID = "a-client-id" as NonEmptyString;
const REDIRECT_URI = new URL(
  "https://api-web.io.pagopa.it/ioweb/auth/v2/callback",
);
const AUTHORIZATION_ENDPOINT = new URL(
  "https://oneid.pagopa.it/oidc/authorize",
);
const IP = "203.0.113.7" as IPString;
const IP_HASH = createHash("sha256").update(IP).digest("hex");

const anInput: StartLoginInput = {
  oidcConfigurationEnv: "PROD",
  minAuthLevel: "SpidL2",
  idp: "https://idp.example.com" as NonEmptyString,
  ipAddress: IP,
};

const auxiliaryDataPort = {
  save: vi.fn(),
  retrieve: vi.fn(),
  healthcheck: vi.fn(),
} satisfies AuxiliaryDataPort;
const oidcClientPort = {
  exchange: vi.fn(),
  getAuthorizationEndpoint: vi.fn(),
} satisfies OidcClientPort;
const oidcConfigPort = { getConfig: vi.fn() } satisfies OidcConfigPort;
const logger = { trackEvent: vi.fn() };

const useCase = makeStartLoginUseCase({
  auxiliaryDataPort,
  oidcClientPort,
  oidcConfigPort,
  logger,
});

const trackedProperties = (name: string) => {
  expect(logger.trackEvent).toHaveBeenCalledOnce();
  const [event] = logger.trackEvent.mock.calls[0];
  expect(event.name).toBe(name);
  return event.properties as Record<string, unknown>;
};

beforeEach(() => {
  vi.clearAllMocks();
  oidcConfigPort.getConfig.mockReturnValue(
    ok({
      clientId: CLIENT_ID,
      clientSecret: "a-secret" as NonEmptyString,
      baseUrl: new URL("https://oneid.pagopa.it"),
      redirectUri: REDIRECT_URI,
    }),
  );
  oidcClientPort.getAuthorizationEndpoint.mockResolvedValue(
    ok(AUTHORIZATION_ENDPOINT),
  );
  auxiliaryDataPort.save.mockResolvedValue(ok(undefined));
});

describe("makeStartLoginUseCase", () => {
  it("stores the auxiliary data without the idp and returns the authorization parameters", async () => {
    const result = await useCase(anInput);

    expect(auxiliaryDataPort.save).toHaveBeenCalledExactlyOnceWith(MOCKED_HEX, {
      clientId: CLIENT_ID,
      minAuthLevel: "SpidL2",
      oidcConfigurationEnv: "PROD",
      nonce: MOCKED_HEX,
    });
    expect(result).toEqual(
      ok({
        authorizationEndpoint: AUTHORIZATION_ENDPOINT,
        clientId: CLIENT_ID,
        redirectUri: REDIRECT_URI,
        scope: "openid",
        state: MOCKED_HEX,
        nonce: MOCKED_HEX,
        responseType: "code",
        acrValues: "https://www.spid.gov.it/SpidL2",
        idp: "https://idp.example.com",
      }),
    );
  });

  it("accepts SpidL1 logins", async () => {
    const result = await useCase({ ...anInput, minAuthLevel: "SpidL1" });

    expect(result._unsafeUnwrap().acrValues).toBe(
      "https://www.spid.gov.it/SpidL1",
    );
  });

  it("tracks a success event with the hashed client IP and correlation ids", async () => {
    await useCase(anInput);

    const properties = trackedProperties("ioweb-auth.oidc.login.success.info");
    expect(properties).toEqual({
      samplingEnabled: false,
      ipHash: IP_HASH,
      clientId: CLIENT_ID,
      env: "PROD",
      idp: "https://idp.example.com",
      minAuthLevel: "SpidL2",
      state: MOCKED_HEX,
      nonce: MOCKED_HEX,
    });
    expect(JSON.stringify(properties)).not.toContain(IP);
  });

  it("returns the ValidationError and tracks it when the environment is not configured", async () => {
    const error = new ValidationError("missing config");
    oidcConfigPort.getConfig.mockReturnValueOnce(err(error));

    const result = await useCase({ ...anInput, oidcConfigurationEnv: "UAT" });

    expect(result).toEqual(err(error));
    expect(oidcClientPort.getAuthorizationEndpoint).not.toHaveBeenCalled();
    expect(auxiliaryDataPort.save).not.toHaveBeenCalled();
    expect(trackedProperties("ioweb-auth.oidc.login.config.error")).toEqual({
      samplingEnabled: false,
      failureReason: "environment_not_configured",
      env: "UAT",
      ipHash: IP_HASH,
      idp: anInput.idp,
      minAuthLevel: anInput.minAuthLevel,
    });
  });

  it.each([
    {
      reason: "discovery_failed",
      error: new OidcDiscoveryError("Upstream error detail"),
      expectedEventName: "ioweb-auth.oidc.login.discovery.error",
    },
    {
      reason: "invalid_authorization_endpoint",
      error: new InvalidAuthorizationEndpointError("Upstream error detail"),
      expectedEventName: "ioweb-auth.oidc.login.auth-decode.error",
    },
  ] as const)(
    "tracks $expectedEventName with correlation IDs when the port fails",
    async ({ reason, error, expectedEventName }) => {
      oidcClientPort.getAuthorizationEndpoint.mockResolvedValueOnce(err(error));

      const result = await useCase(anInput);

      expect(result._unsafeUnwrapErr()).toBe(error);
      expect(auxiliaryDataPort.save).not.toHaveBeenCalled();
      expect(trackedProperties(expectedEventName)).toEqual({
        samplingEnabled: false,
        failureReason: reason,
        env: anInput.oidcConfigurationEnv,
        ipHash: IP_HASH,
        idp: anInput.idp,
        minAuthLevel: anInput.minAuthLevel,
        state: MOCKED_HEX,
        nonce: MOCKED_HEX,
      });
    },
  );

  it("returns a GenericError and tracks it with the correlation ids when saving fails", async () => {
    auxiliaryDataPort.save.mockResolvedValueOnce(
      err(new GenericError("redis down")),
    );

    const result = await useCase(anInput);

    expect(result._unsafeUnwrapErr()).toEqual(
      new GenericError(
        "Could not save auxiliary data, caused by: Generic error: redis down",
      ),
    );
    expect(
      trackedProperties("ioweb-auth.oidc.login.auxiliary-data.error"),
    ).toEqual({
      samplingEnabled: false,
      failureReason: "auxiliary_data_save_failed",
      env: anInput.oidcConfigurationEnv,
      ipHash: IP_HASH,
      idp: anInput.idp,
      minAuthLevel: anInput.minAuthLevel,
      state: MOCKED_HEX,
      nonce: MOCKED_HEX,
    });
  });
});
