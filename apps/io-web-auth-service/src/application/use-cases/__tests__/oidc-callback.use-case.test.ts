import { createHash } from "node:crypto";

import {
  GenericError,
  NonEmptyString,
  NonEmptyStringSchema,
  NotFoundError,
  ValidationError,
} from "@pagopa/hexagonal-core";
import {
  type AppInsightsTelemetryClient,
  makeApplicationInsightsLogger,
} from "@pagopa/hexagonal-core/adapters/logger";
import { type IPString } from "@pagopa/io-auth-n-identity-domain";
import { err, ok } from "neverthrow";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { aValidClaims as aClaims } from "../../../__mocks__/session.mocks.js";
import {
  OidcCodeExchangeError,
  OidcDiscoveryError,
} from "../../../domain/errors/oidc.errors.js";
import type { AuxiliaryDataPort } from "../../../domain/ports/outbound/auxiliary-data.port.js";
import type { OidcClientPort } from "../../../domain/ports/outbound/oidc.port.js";
import type { LoginAuxiliaryData } from "../../../domain/value-objects/login.vo.js";
import type { OidcCallbackParams } from "../../../domain/value-objects/oidc.vo.js";
import type { ActivateUserSessionUseCase } from "../activate-user-session.use-case.js";
import { makeHandleOidcCallbackUseCase } from "../oidc-callback.use-case.js";

const STATE = "a-state" as NonEmptyString;
const CODE = "a-code" as NonEmptyString;
const TOKEN = "a-session-token" as NonEmptyString;
const ACCESS_DENIED = NonEmptyStringSchema.parse("access_denied");
const IP = "203.0.113.7" as IPString;
const IP_HASH = createHash("sha256").update(IP).digest("hex");

const anAuxiliaryData: LoginAuxiliaryData = {
  clientId: "a-client-id" as NonEmptyString,
  minAuthLevel: "SpidL2",
  oidcConfigurationEnv: "UAT",
  nonce: "a-nonce" as NonEmptyString,
};

const commonProperties = {
  samplingEnabled: false,
  ipHash: IP_HASH,
};
const flowProperties = {
  ...commonProperties,
  env: anAuxiliaryData.oidcConfigurationEnv,
  state: STATE,
  nonce: anAuxiliaryData.nonce,
};

const auxiliaryDataPort = {
  save: vi.fn<AuxiliaryDataPort["save"]>(),
  retrieve: vi.fn<AuxiliaryDataPort["retrieve"]>(),
  healthcheck: vi.fn<AuxiliaryDataPort["healthcheck"]>(),
} satisfies AuxiliaryDataPort;

const oidcClientPort = {
  exchange: vi.fn<OidcClientPort["exchange"]>(),
  getAuthorizationEndpoint: vi.fn<OidcClientPort["getAuthorizationEndpoint"]>(),
} satisfies OidcClientPort;

const activateUserSessionUseCase = vi.fn<ActivateUserSessionUseCase>();
const telemetryClient = {
  trackEvent: vi.fn(),
  trackException: vi.fn(),
  trackTrace: vi.fn(),
} satisfies AppInsightsTelemetryClient;
const logger = makeApplicationInsightsLogger({ client: telemetryClient });

const useCase = makeHandleOidcCallbackUseCase({
  auxiliaryDataPort,
  oidcClientPort,
  activateUserSessionUseCase,
  logger,
});

const runCallback = (callback: OidcCallbackParams) =>
  useCase({ callback, ipAddress: IP });

const trackedEvent = (name: string) => {
  expect(telemetryClient.trackEvent).toHaveBeenCalledOnce();
  const [event] = telemetryClient.trackEvent.mock.calls[0];
  expect(event.name).toBe(name);
  expect(JSON.stringify(event.properties)).not.toContain(IP);
  return event.properties as Record<string, unknown>;
};

describe("makeHandleOidcCallbackUseCase", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    auxiliaryDataPort.retrieve.mockResolvedValue(ok(anAuxiliaryData));
    oidcClientPort.exchange.mockResolvedValue(ok(aClaims));
    activateUserSessionUseCase.mockResolvedValue(ok(TOKEN));
  });

  describe("success callback", () => {
    it("consumes the state, exchanges the code and activates the user session", async () => {
      const result = await runCallback({ state: STATE, code: CODE });

      expect(result._unsafeUnwrap()).toEqual({
        outcome: "success",
        token: TOKEN,
      });
      expect(auxiliaryDataPort.retrieve).toHaveBeenCalledExactlyOnceWith(STATE);
      expect(oidcClientPort.exchange).toHaveBeenCalledExactlyOnceWith({
        env: anAuxiliaryData.oidcConfigurationEnv,
        code: CODE,
        state: STATE,
        expectedNonce: anAuxiliaryData.nonce,
      });
      expect(activateUserSessionUseCase).toHaveBeenCalledExactlyOnceWith({
        fiscalCode: aClaims.fiscalNumber,
        name: aClaims.name,
        familyName: aClaims.familyName,
        spidLevel: aClaims.acr,
      });
    });

    it("tracks the verified event with the correlation ids and the identity provider", async () => {
      await runCallback({ state: STATE, code: CODE });

      expect(trackedEvent("ioweb-auth.oidc.callback.verified.info")).toEqual({
        ...flowProperties,
        acr: aClaims.acr,
        idpEntityId: aClaims.idpEntityId,
      });
    });

    it.each([
      {
        case: "unknown or already consumed",
        error: new NotFoundError("LoginAuxiliaryData", "not found"),
      },
      { case: "not retrievable", error: new GenericError("redis down") },
    ])(
      "returns ValidationError and tracks it when the login state is $case",
      async ({ error }) => {
        auxiliaryDataPort.retrieve.mockResolvedValueOnce(err(error));

        const result = await runCallback({ state: STATE, code: CODE });

        expect(result._unsafeUnwrapErr()).toEqual(
          new ValidationError("Missing or expired login state"),
        );
        expect(oidcClientPort.exchange).not.toHaveBeenCalled();
        expect(activateUserSessionUseCase).not.toHaveBeenCalled();
        expect(
          trackedEvent("ioweb-auth.oidc.callback.auxiliary-data.error"),
        ).toEqual({
          ...commonProperties,
          state: STATE,
          failureReason: "auxiliary_data_unavailable",
        });
      },
    );

    it.each([
      {
        error: new OidcDiscoveryError("discovery failed"),
        expectedEventName: "ioweb-auth.oidc.callback.discovery.error",
      },
      {
        error: new OidcCodeExchangeError("code exchange failed"),
        expectedEventName: "ioweb-auth.oidc.callback.code-exchange.error",
      },
    ])(
      "propagates the $error.reason exchange error and tracks $expectedEventName",
      async ({ error, expectedEventName }) => {
        oidcClientPort.exchange.mockResolvedValueOnce(err(error));

        const result = await runCallback({ state: STATE, code: CODE });

        expect(result._unsafeUnwrapErr()).toBe(error);
        expect(activateUserSessionUseCase).not.toHaveBeenCalled();
        expect(trackedEvent(expectedEventName)).toEqual({
          ...flowProperties,
          failureReason: error.reason,
        });
      },
    );

    it("propagates the session activation error and tracks it instead of the verified event", async () => {
      const error = new GenericError("cannot sign");
      activateUserSessionUseCase.mockResolvedValueOnce(err(error));

      const result = await runCallback({ state: STATE, code: CODE });

      expect(result._unsafeUnwrapErr()).toBe(error);
      expect(trackedEvent("ioweb-auth.oidc.callback.domain.error")).toEqual({
        ...flowProperties,
        acr: aClaims.acr,
        idpEntityId: aClaims.idpEntityId,
        failureReason: "session_activation_failed",
      });
    });

    it.each([
      { minAuthLevel: "SpidL1", acr: "https://www.spid.gov.it/SpidL2" },
      { minAuthLevel: "SpidL2", acr: "https://www.spid.gov.it/SpidL2" },
      { minAuthLevel: "SpidL2", acr: "https://www.spid.gov.it/SpidL3" },
    ] as const)(
      "activates the session when the granted level $acr satisfies $minAuthLevel",
      async ({ minAuthLevel, acr }) => {
        auxiliaryDataPort.retrieve.mockResolvedValueOnce(
          ok({ ...anAuxiliaryData, minAuthLevel }),
        );
        oidcClientPort.exchange.mockResolvedValueOnce(ok({ ...aClaims, acr }));

        const result = await runCallback({ state: STATE, code: CODE });

        expect(result._unsafeUnwrap()).toEqual({
          outcome: "success",
          token: TOKEN,
        });
        expect(activateUserSessionUseCase).toHaveBeenCalledOnce();
      },
    );

    it("rejects an insufficient SPID level without activating the session", async () => {
      auxiliaryDataPort.retrieve.mockResolvedValueOnce(
        ok({ ...anAuxiliaryData, minAuthLevel: "SpidL3" }),
      );

      const result = await runCallback({ state: STATE, code: CODE });

      expect(result._unsafeUnwrapErr()).toEqual(
        new ValidationError(
          "Insufficient SPID level: required SpidL3, received SpidL2",
        ),
      );
      expect(activateUserSessionUseCase).not.toHaveBeenCalled();
      expect(trackedEvent("ioweb-auth.oidc.callback.spid-level.error")).toEqual(
        {
          ...flowProperties,
          acr: aClaims.acr,
          idpEntityId: aClaims.idpEntityId,
          minAuthLevel: "SpidL3",
          failureReason: "insufficient_spid_level",
        },
      );
    });
  });

  describe("error callback", () => {
    it("returns the error with the numeric code from error_description and tracks it", async () => {
      const result = await runCallback({
        state: STATE,
        error: ACCESS_DENIED,
        error_description: NonEmptyStringSchema.parse("1002"),
      });

      expect(result._unsafeUnwrap()).toEqual({
        outcome: "error",
        errorCode: 1002,
        errorMessage: "access_denied",
      });
      expect(oidcClientPort.exchange).not.toHaveBeenCalled();
      expect(activateUserSessionUseCase).not.toHaveBeenCalled();
      expect(
        trackedEvent("ioweb-auth.oidc.callback.upstream-error.warning"),
      ).toEqual({
        ...commonProperties,
        redirectTarget: "client_error",
        state: STATE,
        oiError: "access_denied",
        oiErrorDescription: "1002",
      });
    });

    it.each(["not-a-number", "0"])(
      "returns no code when error_description is %s",
      async (errorDescription) => {
        const result = await runCallback({
          state: STATE,
          error: ACCESS_DENIED,
          error_description: NonEmptyStringSchema.parse(errorDescription),
        });

        expect(result._unsafeUnwrap()).toEqual({
          outcome: "error",
          errorCode: undefined,
          errorMessage: "access_denied",
        });
      },
    );

    it("tracks the provider error without the description when it is missing", async () => {
      await runCallback({ state: STATE, error: ACCESS_DENIED });

      expect(
        trackedEvent("ioweb-auth.oidc.callback.upstream-error.warning"),
      ).toEqual({
        ...commonProperties,
        redirectTarget: "client_error",
        state: STATE,
        oiError: "access_denied",
      });
    });

    it("returns the default error and tracks an invalid callback input when both code and error are absent", async () => {
      const result = await runCallback({ state: STATE });

      expect(result._unsafeUnwrap()).toEqual({
        outcome: "error",
        errorCode: undefined,
        errorMessage: "invalid OIDC error callback inputs",
      });
      expect(oidcClientPort.exchange).not.toHaveBeenCalled();
      expect(
        trackedEvent("ioweb-auth.oidc.callback.upstream-error.warning"),
      ).toEqual({
        ...commonProperties,
        redirectTarget: "client_error",
        state: STATE,
        failureReason: "invalid_callback_input",
      });
    });

    it.each([
      {
        case: "a provider error",
        callback: { state: STATE, error: ACCESS_DENIED },
      },
      { case: "no error", callback: { state: STATE } },
    ])(
      "discards the auxiliary data of the state on $case",
      async ({ callback }) => {
        await runCallback(callback);

        expect(auxiliaryDataPort.retrieve).toHaveBeenCalledExactlyOnceWith(
          STATE,
        );
      },
    );

    it("does not track a remediation warning when the state is already gone", async () => {
      auxiliaryDataPort.retrieve.mockResolvedValueOnce(
        err(new NotFoundError("LoginAuxiliaryData", "not found")),
      );

      await runCallback({ state: STATE, error: ACCESS_DENIED });
      await new Promise(setImmediate);

      expect(telemetryClient.trackEvent).toHaveBeenCalledOnce();
      expect(telemetryClient.trackEvent.mock.calls[0][0].name).toBe(
        "ioweb-auth.oidc.callback.upstream-error.warning",
      );
    });

    it.each([
      {
        case: "fails",
        mock: () =>
          auxiliaryDataPort.retrieve.mockResolvedValueOnce(
            err(new GenericError("redis down")),
          ),
      },
      {
        case: "rejects",
        mock: () =>
          auxiliaryDataPort.retrieve.mockRejectedValueOnce(
            new Error("unexpected"),
          ),
      },
    ])(
      "still redirects to the error page and tracks a remediation warning when the state cleanup $case",
      async ({ mock }) => {
        mock();

        const result = await runCallback({
          state: STATE,
          error: ACCESS_DENIED,
        });

        expect(result._unsafeUnwrap()).toEqual({
          outcome: "error",
          errorCode: undefined,
          errorMessage: "access_denied",
        });
        await vi.waitFor(() =>
          expect(telemetryClient.trackEvent).toHaveBeenCalledWith({
            name: "ioweb-auth.oidc.callback.auxiliary-remediation.warning",
            properties: {
              ...commonProperties,
              state: STATE,
              failureReason: "auxiliary_data_cleanup_failed",
            },
          }),
        );
      },
    );
  });
});
