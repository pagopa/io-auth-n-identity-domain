import { beforeEach, describe, it, vi, expect } from "vitest";
import { isOrchestratorRunning, startOrchestrator } from "../durable";
import {
  makeGetStatus404Error,
  mockGetClient,
  mockGetStatus,
  mockStartNew,
} from "../../functions/__mocks__/durable-functions";
import * as E from "fp-ts/lib/Either";
import { OrchestrationRuntimeStatus } from "durable-functions";
import * as t from "io-ts";

const dfClient = mockGetClient();
const anInstanceId = "fb510573-79a5-429a-ada3-35da005044e0";

describe("isOrchestratorRunning", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each`
    status
    ${OrchestrationRuntimeStatus.Completed}
    ${OrchestrationRuntimeStatus.Canceled}
    ${OrchestrationRuntimeStatus.Failed}
    ${OrchestrationRuntimeStatus.Suspended}
    ${OrchestrationRuntimeStatus.Terminated}
  `("should return false for $status orchestrator", async ({ status }) => {
    mockGetStatus.mockResolvedValueOnce({
      name: "MOCKED",
      instanceId: anInstanceId,
      createdTime: new Date(),
      lastUpdatedTime: new Date(),
      input: {},
      output: {},
      runtimeStatus: status as unknown as OrchestrationRuntimeStatus,
    });
    const result = await isOrchestratorRunning(dfClient, anInstanceId)();
    expect(result).toMatchObject(
      E.right({
        isRunning: false,
      }),
    );
  });

  it.each`
    status
    ${OrchestrationRuntimeStatus.Running}
    ${OrchestrationRuntimeStatus.Pending}
  `("should return true for $status orchestrator", async ({ status }) => {
    mockGetStatus.mockResolvedValueOnce({
      name: "MOCKED",
      instanceId: anInstanceId,
      createdTime: new Date(),
      lastUpdatedTime: new Date(),
      input: {},
      output: {},
      runtimeStatus: status as unknown as OrchestrationRuntimeStatus,
    });
    const result = await isOrchestratorRunning(dfClient, anInstanceId)();
    expect(result).toMatchObject(
      E.right({
        isRunning: true,
      }),
    );
  });

  it("should return status unknown for instance not found error", async () => {
    mockGetStatus.mockRejectedValueOnce(makeGetStatus404Error(anInstanceId));
    const result = await isOrchestratorRunning(dfClient, anInstanceId)();
    expect(result).toMatchObject(
      E.right({
        isRunning: false,
        runtimeStatus: "Unknown",
      }),
    );
  });

  it("should return error when getStatus rejects", async () => {
    const anError = Error("an error occurred");
    mockGetStatus.mockRejectedValueOnce(anError);
    const result = await isOrchestratorRunning(dfClient, anInstanceId)();
    expect(result).toMatchObject(E.left(anError));
  });
});

describe("startOrchestrator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should not start orchestrator if it's running", async () => {
    mockGetStatus.mockResolvedValueOnce({
      name: "MOCKED",
      instanceId: anInstanceId,
      createdTime: new Date(),
      lastUpdatedTime: new Date(),
      input: {},
      output: {},
      runtimeStatus: OrchestrationRuntimeStatus.Running,
    });
    const result = await startOrchestrator(
      dfClient,
      "MOCKED",
      anInstanceId,
      {},
      t.UnknownRecord,
    )();

    expect(mockStartNew).not.toHaveBeenCalled();
    expect(result).toEqual(E.right(anInstanceId));
  });

  it.each`
    status
    ${OrchestrationRuntimeStatus.Completed}
    ${OrchestrationRuntimeStatus.Canceled}
    ${OrchestrationRuntimeStatus.Failed}
    ${OrchestrationRuntimeStatus.Suspended}
    ${OrchestrationRuntimeStatus.Terminated}
    ${"Unknown"}
  `(
    "should start orchestrator if its not running (status $status)",
    async ({ status }) => {
      mockGetStatus.mockResolvedValueOnce({
        name: "MOCKED",
        instanceId: anInstanceId,
        createdTime: new Date(),
        lastUpdatedTime: new Date(),
        input: {},
        output: {},
        runtimeStatus: status as unknown as OrchestrationRuntimeStatus,
      });
      mockStartNew.mockResolvedValueOnce(anInstanceId);
      const result = await startOrchestrator(
        dfClient,
        "MOCKED",
        anInstanceId,
        {},
        t.UnknownRecord,
      )();

      expect(mockStartNew).toHaveBeenCalledTimes(1);
      expect(result).toEqual(E.right(anInstanceId));
    },
  );

  it("should return error if getStatus rejects", async () => {
    const anError = Error("an error occurred");
    mockGetStatus.mockRejectedValueOnce(anError);

    const result = await startOrchestrator(
      dfClient,
      "MOCKED",
      anInstanceId,
      {},
      t.UnknownRecord,
    )();

    expect(mockStartNew).not.toHaveBeenCalled();
    expect(result).toEqual(E.left(anError));
  });

  it("should return error if startNew rejects", async () => {
    const anError = Error("an error occurred");
    mockStartNew.mockRejectedValueOnce(anError);

    const result = await startOrchestrator(
      dfClient,
      "MOCKED",
      anInstanceId,
      {},
      t.UnknownRecord,
    )();

    expect(mockStartNew).toHaveBeenCalledTimes(1);
    expect(result).toEqual(E.left(anError));
  });
});
