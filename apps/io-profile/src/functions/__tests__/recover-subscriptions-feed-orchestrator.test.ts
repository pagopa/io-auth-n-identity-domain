/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi, beforeEach } from "vitest";
import * as df from "durable-functions";
import * as E from "fp-ts/lib/Either";
import { ServicesPreferencesModeEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/ServicesPreferencesMode";
import { readableReport } from "@pagopa/ts-commons/lib/reporters";
import { context as contextMock } from "../__mocks__/durable-functions";
import {
  aFiscalCode,
  aRetrievedProfile,
  aRetrievedProfileVersion1,
  aRetrievedProfileVersion2,
  autoProfileServicePreferencesSettings,
  legacyProfileServicePreferencesSettings,
  manualProfileServicePreferencesSettings,
} from "../__mocks__/mocks";
import { consumeGenerator } from "../../utils/durable";
import {
  ActivityName as UpdateSubscriptionFeedActivityName,
  Input as UpdateSubscriptionFeedActivityInput,
} from "../update-subscriptions-feed-activity";
import {
  ActivityName as GetProfileVersionsForRecoveryActivityName,
  ActivityResult as GetProfileVersionsForRecoveryActivityResult,
} from "../get-profile-versions-for-recovery-activity";
import { TransientFailure } from "../../utils/durable";
import {
  getRecoverSubscriptionsFeedOrchestratorHandler,
  OrchestratorInput,
} from "../recover-subscriptions-feed-orchestrator";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";

const retryOptions = new df.RetryOptions(5000, 3);
// eslint-disable-next-line functional/immutable-data
retryOptions.backoffCoefficient = 1.5;

const mockTelemetryClient = () => ({
  trackEvent: vi.fn(),
});

const decodeInput = (input: unknown) =>
  E.getOrElseW((errs: any) => {
    throw new Error(`Cannot decode input: ${readableReport(errs)}`);
  })(OrchestratorInput.decode(input));

const aDay = "2009-02-13";

const recoveryActivityDefaultResult =
  GetProfileVersionsForRecoveryActivityResult.encode({
    kind: "FOUND",
    lastTimestamp: 0,
    lastVersion: 0 as NonNegativeInteger,
    currentDayModes: [],
    previousMode: undefined,
  });

const createContextMock = (input: unknown, mocks: Record<string, unknown>) => ({
  ...contextMock,
  df: {
    Task: {
      all: (tasks: ReadonlyArray<unknown>) => tasks,
    },
    callActivityWithRetry: vi.fn(
      (name: string, ..._rest: ReadonlyArray<unknown>) =>
        mocks[name] ?? recoveryActivityDefaultResult,
    ),
    getInput: vi.fn(() => input),
    isReplaying: false,
  },
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("RecoverSubscriptionsFeedOrchestrator", () => {
  it("should SUBSCRIBE a v0 profile and set updatedAt to _ts * 1000", () => {
    const profile = {
      ...aRetrievedProfile,
      _ts: 1234567890,
      servicePreferencesSettings: autoProfileServicePreferencesSettings,
      version: 0 as NonNegativeInteger,
    };
    const telemetryClient = mockTelemetryClient();
    const ctx = createContextMock(
      decodeInput({ fiscalCode: aFiscalCode, day: aDay }),
      {
        [GetProfileVersionsForRecoveryActivityName]:
          GetProfileVersionsForRecoveryActivityResult.encode({
            kind: "FOUND",
            lastTimestamp: profile._ts,
            lastVersion: profile.version,
            currentDayModes: [profile.servicePreferencesSettings.mode],
            previousMode: undefined,
          }),
      },
    );

    const handler = getRecoverSubscriptionsFeedOrchestratorHandler({
      dryRun: false,
      telemetryClient: telemetryClient as any,
    })(ctx as any);

    consumeGenerator(handler);

    expect(ctx.df.callActivityWithRetry).toHaveBeenCalledWith(
      UpdateSubscriptionFeedActivityName,
      retryOptions,
      expect.objectContaining({
        fiscalCode: aFiscalCode,
        operation: "SUBSCRIBED",
        subscriptionKind: "PROFILE",
        updatedAt: profile._ts * 1000,
        version: 0,
      } as UpdateSubscriptionFeedActivityInput),
    );

    const callArgs = ctx.df.callActivityWithRetry.mock.calls.find(
      ([name]) => name === UpdateSubscriptionFeedActivityName,
    )?.[2] as unknown as UpdateSubscriptionFeedActivityInput | undefined;
    expect(callArgs).not.toHaveProperty("previousPreferences");
  });

  it("should recompute all versions in a day and update the feed once", () => {
    const firstProfile = aRetrievedProfileVersion1(
      ServicesPreferencesModeEnum.MANUAL,
    );
    const lastProfile = aRetrievedProfileVersion2(
      ServicesPreferencesModeEnum.AUTO,
    );
    const telemetryClient = mockTelemetryClient();
    const ctx = createContextMock(
      decodeInput({ fiscalCode: aFiscalCode, day: aDay }),
      {
        [GetProfileVersionsForRecoveryActivityName]:
          GetProfileVersionsForRecoveryActivityResult.encode({
            kind: "FOUND",
            lastTimestamp: lastProfile._ts,
            lastVersion: lastProfile.version,
            currentDayModes: [
              firstProfile.servicePreferencesSettings.mode,
              lastProfile.servicePreferencesSettings.mode,
            ],
            previousMode: ServicesPreferencesModeEnum.LEGACY,
          }),
      },
    );

    const handler = getRecoverSubscriptionsFeedOrchestratorHandler({
      dryRun: false,
      telemetryClient: telemetryClient as any,
    })(ctx as any);

    consumeGenerator(handler);

    const updateCalls = ctx.df.callActivityWithRetry.mock.calls.filter(
      ([name]) => name === UpdateSubscriptionFeedActivityName,
    );
    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0][2]).toEqual(
      expect.objectContaining({
        fiscalCode: aFiscalCode,
        operation: "SUBSCRIBED",
        updatedAt: lastProfile._ts * 1000,
        version: lastProfile.version,
      }),
    );
  });

  it("should SUBSCRIBE when mode changes from MANUAL to AUTO", () => {
    const previousProfile = aRetrievedProfileVersion1(
      ServicesPreferencesModeEnum.MANUAL,
    );
    const currentProfile = aRetrievedProfileVersion2(
      ServicesPreferencesModeEnum.AUTO,
    );
    const telemetryClient = mockTelemetryClient();
    const ctx = createContextMock(
      decodeInput({ fiscalCode: aFiscalCode, day: aDay }),
      {
        [GetProfileVersionsForRecoveryActivityName]:
          GetProfileVersionsForRecoveryActivityResult.encode({
            kind: "FOUND",
            lastTimestamp: currentProfile._ts,
            lastVersion: currentProfile.version,
            currentDayModes: [
              previousProfile.servicePreferencesSettings.mode,
              currentProfile.servicePreferencesSettings.mode,
            ],
            previousMode: previousProfile.servicePreferencesSettings.mode,
          }),
      },
    );

    const handler = getRecoverSubscriptionsFeedOrchestratorHandler({
      dryRun: false,
      telemetryClient: telemetryClient as any,
    })(ctx as any);

    consumeGenerator(handler);

    expect(ctx.df.callActivityWithRetry).toHaveBeenCalledWith(
      UpdateSubscriptionFeedActivityName,
      retryOptions,
      expect.objectContaining({
        operation: "SUBSCRIBED",
        version: currentProfile.version,
      }),
    );
  });

  it("should UNSUBSCRIBE when mode changes from AUTO to MANUAL", () => {
    const previousProfile = aRetrievedProfileVersion1(
      ServicesPreferencesModeEnum.AUTO,
    );
    const currentProfile = aRetrievedProfileVersion2(
      ServicesPreferencesModeEnum.MANUAL,
    );
    const telemetryClient = mockTelemetryClient();
    const ctx = createContextMock(
      decodeInput({ fiscalCode: aFiscalCode, day: aDay }),
      {
        [GetProfileVersionsForRecoveryActivityName]:
          GetProfileVersionsForRecoveryActivityResult.encode({
            kind: "FOUND",
            lastTimestamp: currentProfile._ts,
            lastVersion: currentProfile.version,
            currentDayModes: [
              previousProfile.servicePreferencesSettings.mode,
              currentProfile.servicePreferencesSettings.mode,
            ],
            previousMode: previousProfile.servicePreferencesSettings.mode,
          }),
      },
    );

    const handler = getRecoverSubscriptionsFeedOrchestratorHandler({
      dryRun: false,
      telemetryClient: telemetryClient as any,
    })(ctx as any);

    consumeGenerator(handler);

    expect(ctx.df.callActivityWithRetry).toHaveBeenCalledWith(
      UpdateSubscriptionFeedActivityName,
      retryOptions,
      expect.objectContaining({
        operation: "UNSUBSCRIBED",
        version: currentProfile.version,
      }),
    );
  });

  it("should not call UpdateSubscriptionFeedActivity for LEGACY -> AUTO", () => {
    const previousProfile = aRetrievedProfileVersion1(
      ServicesPreferencesModeEnum.LEGACY,
    );
    const currentProfile = aRetrievedProfileVersion2(
      ServicesPreferencesModeEnum.AUTO,
    );
    const telemetryClient = mockTelemetryClient();
    const ctx = createContextMock(
      decodeInput({ fiscalCode: aFiscalCode, day: aDay }),
      {
        [GetProfileVersionsForRecoveryActivityName]:
          GetProfileVersionsForRecoveryActivityResult.encode({
            kind: "FOUND",
            lastTimestamp: currentProfile._ts,
            lastVersion: currentProfile.version,
            currentDayModes: [
              previousProfile.servicePreferencesSettings.mode,
              currentProfile.servicePreferencesSettings.mode,
            ],
            previousMode: previousProfile.servicePreferencesSettings.mode,
          }),
      },
    );

    const handler = getRecoverSubscriptionsFeedOrchestratorHandler({
      dryRun: false,
      telemetryClient: telemetryClient as any,
    })(ctx as any);

    consumeGenerator(handler);

    const updateCalls = ctx.df.callActivityWithRetry.mock.calls.filter(
      ([name]) => name === UpdateSubscriptionFeedActivityName,
    );
    expect(updateCalls).toHaveLength(0);
  });

  it("should not call UpdateSubscriptionFeedActivity when mode is unchanged", () => {
    const previousProfile = aRetrievedProfileVersion1(
      ServicesPreferencesModeEnum.AUTO,
    );
    const currentProfile = aRetrievedProfileVersion2(
      ServicesPreferencesModeEnum.AUTO,
    );
    const telemetryClient = mockTelemetryClient();
    const ctx = createContextMock(
      decodeInput({ fiscalCode: aFiscalCode, day: aDay }),
      {
        [GetProfileVersionsForRecoveryActivityName]:
          GetProfileVersionsForRecoveryActivityResult.encode({
            kind: "FOUND",
            lastTimestamp: currentProfile._ts,
            lastVersion: currentProfile.version,
            currentDayModes: [
              previousProfile.servicePreferencesSettings.mode,
              currentProfile.servicePreferencesSettings.mode,
            ],
            previousMode: previousProfile.servicePreferencesSettings.mode,
          }),
      },
    );

    const handler = getRecoverSubscriptionsFeedOrchestratorHandler({
      dryRun: false,
      telemetryClient: telemetryClient as any,
    })(ctx as any);

    consumeGenerator(handler);

    const updateCalls = ctx.df.callActivityWithRetry.mock.calls.filter(
      ([name]) => name === UpdateSubscriptionFeedActivityName,
    );
    expect(updateCalls).toHaveLength(0);
  });

  it("should track failure and return false when no profile versions are found", () => {
    const telemetryClient = mockTelemetryClient();
    const ctx = createContextMock(
      decodeInput({ fiscalCode: aFiscalCode, day: aDay }),
      {
        [GetProfileVersionsForRecoveryActivityName]:
          GetProfileVersionsForRecoveryActivityResult.encode({
            kind: "NOT_FOUND",
          }),
      },
    );

    const handler = getRecoverSubscriptionsFeedOrchestratorHandler({
      dryRun: false,
      telemetryClient: telemetryClient as any,
    })(ctx as any);

    const result = consumeGenerator(handler);

    expect(result).toBe(false);
    expect(telemetryClient.trackEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "subscriptionFeed.recovery.failure",
        properties: expect.objectContaining({
          kind: "NOT_FOUND",
          step: "READ_PREVIOUS_VERSION",
        }),
      }),
    );
    const updateCalls = ctx.df.callActivityWithRetry.mock.calls.filter(
      ([name]) => name === UpdateSubscriptionFeedActivityName,
    );
    expect(updateCalls).toHaveLength(0);
  });

  it("should track failure and return false when GetProfileVersionsForRecoveryActivity returns a transient failure", () => {
    const telemetryClient = mockTelemetryClient();
    const ctx = createContextMock(
      decodeInput({ fiscalCode: aFiscalCode, day: aDay }),
      {
        [GetProfileVersionsForRecoveryActivityName]: TransientFailure.encode({
          kind: "TRANSIENT_FAILURE",
          reason: "Invalid activity input",
        }),
      },
    );

    const handler = getRecoverSubscriptionsFeedOrchestratorHandler({
      dryRun: false,
      telemetryClient: telemetryClient as any,
    })(ctx as any);

    const result = consumeGenerator(handler);

    expect(result).toBe(false);
    expect(telemetryClient.trackEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "subscriptionFeed.recovery.failure",
        properties: expect.objectContaining({
          kind: "EXCEPTION",
          step: "READ_PREVIOUS_VERSION",
        }),
      }),
    );
    const updateCalls = ctx.df.callActivityWithRetry.mock.calls.filter(
      ([name]) => name === UpdateSubscriptionFeedActivityName,
    );
    expect(updateCalls).toHaveLength(0);
  });

  it("should track failure and return false when UpdateSubscriptionFeedActivity throws", () => {
    const previousProfile = aRetrievedProfileVersion1(
      ServicesPreferencesModeEnum.AUTO,
    );
    const currentProfile = aRetrievedProfileVersion2(
      ServicesPreferencesModeEnum.MANUAL,
    );
    const telemetryClient = mockTelemetryClient();
    const ctx = createContextMock(
      decodeInput({ fiscalCode: aFiscalCode, day: aDay }),
      {
        [GetProfileVersionsForRecoveryActivityName]:
          GetProfileVersionsForRecoveryActivityResult.encode({
            kind: "FOUND",
            lastTimestamp: currentProfile._ts,
            lastVersion: currentProfile.version,
            currentDayModes: [
              previousProfile.servicePreferencesSettings.mode,
              currentProfile.servicePreferencesSettings.mode,
            ],
            previousMode: previousProfile.servicePreferencesSettings.mode,
          }),
      },
    );

    const gen = getRecoverSubscriptionsFeedOrchestratorHandler({
      dryRun: false,
      telemetryClient: telemetryClient as any,
    })(ctx as any);

    // Manually drive the generator and throw into it when the update activity
    // is yielded, simulating a failed Durable Task.
    let prevValue: unknown;
    let yieldedCount = 0;
    let result: boolean | undefined;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = gen.next(prevValue);
      if (done) {
        result = value as boolean;
        break;
      }
      yieldedCount += 1;
      if (yieldedCount === 2) {
        const throwResult = gen.throw(new Error("update failed"));
        if (throwResult.done) {
          result = throwResult.value as boolean;
          break;
        }
        prevValue = throwResult.value;
      } else {
        prevValue = value;
      }
    }

    expect(result).toBe(false);
    expect(telemetryClient.trackEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "subscriptionFeed.recovery.failure",
        properties: expect.objectContaining({
          kind: "EXCEPTION",
          step: "UPDATE_FEED",
        }),
      }),
    );
  });

  it("should not call UpdateSubscriptionFeedActivity in dry-run mode", () => {
    const previousProfile = aRetrievedProfileVersion1(
      ServicesPreferencesModeEnum.AUTO,
    );
    const currentProfile = aRetrievedProfileVersion2(
      ServicesPreferencesModeEnum.MANUAL,
    );
    const telemetryClient = mockTelemetryClient();
    const ctx = createContextMock(
      decodeInput({ fiscalCode: aFiscalCode, day: aDay }),
      {
        [GetProfileVersionsForRecoveryActivityName]:
          GetProfileVersionsForRecoveryActivityResult.encode({
            kind: "FOUND",
            lastTimestamp: currentProfile._ts,
            lastVersion: currentProfile.version,
            currentDayModes: [
              previousProfile.servicePreferencesSettings.mode,
              currentProfile.servicePreferencesSettings.mode,
            ],
            previousMode: previousProfile.servicePreferencesSettings.mode,
          }),
      },
    );

    const handler = getRecoverSubscriptionsFeedOrchestratorHandler({
      dryRun: true,
      telemetryClient: telemetryClient as any,
    })(ctx as any);

    consumeGenerator(handler);

    const updateCalls = ctx.df.callActivityWithRetry.mock.calls.filter(
      ([name]) => name === UpdateSubscriptionFeedActivityName,
    );
    expect(updateCalls).toHaveLength(0);
    expect(telemetryClient.trackEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "subscriptionFeed.recovery.dryRun",
      }),
    );
  });
});
