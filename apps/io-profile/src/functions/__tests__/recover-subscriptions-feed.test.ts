import { describe, expect, it, vi, beforeEach } from "vitest";
import * as df from "durable-functions";
import { context as contextMock } from "../__mocks__/durable-functions";
import {
  aFiscalCode,
  aRetrievedProfile,
  aRetrievedProfileVersion1,
} from "../__mocks__/mocks";
import { ServicesPreferencesModeEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/ServicesPreferencesMode";
import { toHash } from "../../utils/crypto";
import { RecoverSubscriptionsFeed } from "../recover-subscriptions-feed";

const createMockDurableClient = () => ({
  getStatus: vi.fn().mockRejectedValue(new Error("HTTP 404")),
  startNew: vi.fn().mockResolvedValue("instance-id"),
});

vi.mock("durable-functions", async () => {
  const actual = await vi.importActual<typeof import("durable-functions")>(
    "durable-functions",
  );
  return {
    ...actual,
    getClient: vi.fn(),
  };
});

const telemetryClientMock = {
  trackEvent: vi.fn(),
};

const aLeasePrefix = "dryrun-01";

const dependencies = {
  dryRun: false,
  endDate: Number.MAX_SAFE_INTEGER,
  leasePrefix: aLeasePrefix,
  startDate: 0,
  telemetryClient: telemetryClientMock as any,
};

describe("RecoverSubscriptionsFeed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should start an orchestrator for a document in the batch", async () => {
    const profile = aRetrievedProfileVersion1(
      ServicesPreferencesModeEnum.AUTO,
    );
    const dfClient = createMockDurableClient();
    (df.getClient as ReturnType<typeof vi.fn>).mockReturnValue(dfClient);

    const handler = RecoverSubscriptionsFeed(dependencies);

    await handler([profile], contextMock as any);

    expect(dfClient.startNew).toHaveBeenCalledTimes(1);
    expect(dfClient.startNew).toHaveBeenCalledWith(
      "RecoverSubscriptionsFeedOrchestrator",
      expect.objectContaining({
        instanceId: expect.stringMatching(
          new RegExp(
            `^recover-subfeed-.+-${new Date(profile._ts * 1000)
              .toISOString()
              .substring(0, 10)}-${aLeasePrefix}$`,
          ),
        ),
        input: {
          fiscalCode: aFiscalCode,
          day: new Date(profile._ts * 1000).toISOString().substring(0, 10),
        },
      }),
    );
  });

  it("should start one orchestrator per fiscal code and day", async () => {
    const profile1 = aRetrievedProfileVersion1(
      ServicesPreferencesModeEnum.AUTO,
    );
    const profile2 = {
      ...aRetrievedProfile,
      _ts: 2000,
      servicePreferencesSettings: profile1.servicePreferencesSettings,
      version: 2,
    };
    const dfClient = createMockDurableClient();
    (df.getClient as ReturnType<typeof vi.fn>).mockReturnValue(dfClient);

    const handler = RecoverSubscriptionsFeed(dependencies);

    await handler([profile1, profile2], contextMock as any);

    expect(dfClient.startNew).toHaveBeenCalledTimes(1);
  });

  it("should track bad records and continue", async () => {
    const dfClient = createMockDurableClient();
    (df.getClient as ReturnType<typeof vi.fn>).mockReturnValue(dfClient);

    const handler = RecoverSubscriptionsFeed(dependencies);

    await handler([{ invalid: "profile" }], contextMock as any);

    expect(telemetryClientMock.trackEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "subscriptionFeed.recovery.badRecord",
      }),
    );
    expect(dfClient.startNew).not.toHaveBeenCalled();
  });

  it("should reject, track an unsampled event, and log an error when the orchestrator cannot be started", async () => {
    const profile = aRetrievedProfileVersion1(
      ServicesPreferencesModeEnum.AUTO,
    );
    const dfClient = createMockDurableClient();
    dfClient.startNew.mockRejectedValueOnce(new Error("start failed"));
    (df.getClient as ReturnType<typeof vi.fn>).mockReturnValue(dfClient);

    const handler = RecoverSubscriptionsFeed(dependencies);

    await expect(
      handler([profile], contextMock as any),
    ).rejects.toThrow("start failed");

    expect(contextMock.error).toHaveBeenCalledWith(
      expect.stringContaining("Cannot start orchestrator"),
    );
    expect(telemetryClientMock.trackEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "subscriptionFeed.recovery.startError",
        properties: expect.objectContaining({
          kind: "START_FAILED",
        }),
      }),
    );
  });

  it("should not process documents after a startup failure", async () => {
    const profile1 = aRetrievedProfileVersion1(
      ServicesPreferencesModeEnum.AUTO,
    );
    const profile2 = {
      ...aRetrievedProfile,
      _ts: 86400 + 2000,
      servicePreferencesSettings: profile1.servicePreferencesSettings,
      version: 2,
    };
    const dfClient = createMockDurableClient();
    dfClient.startNew.mockResolvedValueOnce("instance-id-1");
    dfClient.startNew.mockRejectedValueOnce(new Error("start failed"));
    (df.getClient as ReturnType<typeof vi.fn>).mockReturnValue(dfClient);

    const handler = RecoverSubscriptionsFeed(dependencies);

    await expect(
      handler([profile1, profile2], contextMock as any),
    ).rejects.toThrow("start failed");

    expect(dfClient.startNew).toHaveBeenCalledTimes(2);
  });

  it("should skip documents outside the recovery window", async () => {
    const profile = aRetrievedProfileVersion1(
      ServicesPreferencesModeEnum.AUTO,
    );
    const dfClient = createMockDurableClient();
    (df.getClient as ReturnType<typeof vi.fn>).mockReturnValue(dfClient);

    const handler = RecoverSubscriptionsFeed({
      ...dependencies,
      endDate: profile._ts * 1000,
      startDate: profile._ts * 1000 - 1,
    });

    await handler([profile], contextMock as any);

    expect(dfClient.startNew).not.toHaveBeenCalled();
  });

  it("should skip documents before the recovery window", async () => {
    const profile = aRetrievedProfileVersion1(
      ServicesPreferencesModeEnum.AUTO,
    );
    const dfClient = createMockDurableClient();
    (df.getClient as ReturnType<typeof vi.fn>).mockReturnValue(dfClient);

    const handler = RecoverSubscriptionsFeed({
      ...dependencies,
      endDate: Number.MAX_SAFE_INTEGER,
      startDate: profile._ts * 1000 + 1,
    });

    await handler([profile], contextMock as any);

    expect(dfClient.startNew).not.toHaveBeenCalled();
  });

  it("should skip a completed singleton orchestration", async () => {
    const profile = aRetrievedProfileVersion1(
      ServicesPreferencesModeEnum.AUTO,
    );
    const dfClient = createMockDurableClient();
    dfClient.getStatus.mockResolvedValue({
      runtimeStatus: df.OrchestrationRuntimeStatus.Completed,
    });
    (df.getClient as ReturnType<typeof vi.fn>).mockReturnValue(dfClient);

    const handler = RecoverSubscriptionsFeed(dependencies);

    await handler([profile], contextMock as any);

    expect(dfClient.startNew).not.toHaveBeenCalled();
  });

  it("should restart a failed singleton orchestration", async () => {
    const profile = aRetrievedProfileVersion1(
      ServicesPreferencesModeEnum.AUTO,
    );
    const dfClient = createMockDurableClient();
    dfClient.getStatus.mockResolvedValue({
      runtimeStatus: df.OrchestrationRuntimeStatus.Failed,
    });
    (df.getClient as ReturnType<typeof vi.fn>).mockReturnValue(dfClient);

    const handler = RecoverSubscriptionsFeed(dependencies);

    await handler([profile], contextMock as any);

    expect(dfClient.startNew).toHaveBeenCalledTimes(1);
  });

  it("should build a different instance id for each lease prefix", async () => {
    const profile = aRetrievedProfileVersion1(
      ServicesPreferencesModeEnum.AUTO,
    );
    const dfClient = createMockDurableClient();
    (df.getClient as ReturnType<typeof vi.fn>).mockReturnValue(dfClient);

    await RecoverSubscriptionsFeed({
      ...dependencies,
      dryRun: true,
      leasePrefix: "dryrun-01",
    })([profile], contextMock as any);
    await RecoverSubscriptionsFeed({
      ...dependencies,
      leasePrefix: "run-01",
    })([profile], contextMock as any);

    expect(dfClient.startNew).toHaveBeenCalledTimes(2);
    const [[, firstOptions], [, secondOptions]] = dfClient.startNew.mock.calls;
    expect(firstOptions.instanceId).toMatch(/-dryrun-01$/);
    expect(secondOptions.instanceId).toMatch(/-run-01$/);
    expect(firstOptions.instanceId).not.toBe(secondOptions.instanceId);
  });

  it("should start a new orchestration when a previous pass completed under another lease prefix", async () => {
    const profile = aRetrievedProfileVersion1(
      ServicesPreferencesModeEnum.AUTO,
    );
    const day = new Date(profile._ts * 1000).toISOString().substring(0, 10);
    const baseInstanceId = `recover-subfeed-${toHash(aFiscalCode)}-${day}`;
    const dfClient = createMockDurableClient();
    // only the dry-run instance exists and is completed: any other instance id
    // is still unknown to the Durable Functions runtime
    dfClient.getStatus.mockImplementation((instanceId: string) =>
      instanceId === `${baseInstanceId}-dryrun-01`
        ? Promise.resolve({
            runtimeStatus: df.OrchestrationRuntimeStatus.Completed,
          })
        : Promise.reject(new Error("HTTP 404")),
    );
    (df.getClient as ReturnType<typeof vi.fn>).mockReturnValue(dfClient);

    await RecoverSubscriptionsFeed({
      ...dependencies,
      dryRun: true,
      leasePrefix: "dryrun-01",
    })([profile], contextMock as any);

    expect(dfClient.startNew).not.toHaveBeenCalled();

    await RecoverSubscriptionsFeed({
      ...dependencies,
      leasePrefix: "run-01",
    })([profile], contextMock as any);

    expect(dfClient.startNew).toHaveBeenCalledTimes(1);
    expect(dfClient.startNew).toHaveBeenCalledWith(
      "RecoverSubscriptionsFeedOrchestrator",
      expect.objectContaining({
        instanceId: `${baseInstanceId}-run-01`,
      }),
    );
  });
});
