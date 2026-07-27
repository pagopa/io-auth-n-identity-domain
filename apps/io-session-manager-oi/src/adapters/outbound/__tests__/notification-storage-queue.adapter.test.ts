import { QueueClient } from "@azure/storage-queue";
import { FiscalCodeSchema, GenericError } from "@pagopa/hexagonal-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationStorageQueueAdapter } from "../notification-storage-queue.adapter.js";

const MOCKED_FISCAL_CODE = FiscalCodeSchema.parse("AAAAAA00A00A000A");
const mocks = vi.hoisted(() => {
  const HASHED_INSTALLATION_ID = "hashed-installation-id";
  const ENCODED_MESSAGE = "base64-encoded-message";
  return {
    HASHED_INSTALLATION_ID,
    ENCODED_MESSAGE,
    queueClient: {
      sendMessage: vi.fn(),
    },
    Base64: {
      encode: vi.fn(() => ENCODED_MESSAGE),
    },
    Hash: {
      sha256: vi.fn(() => HASHED_INSTALLATION_ID),
    },
  };
});

vi.mock("../../../utils/codec.js", () => ({
  Base64: mocks.Base64,
}));

vi.mock("../../../utils/crypto.js", () => ({
  Hash: mocks.Hash,
}));

beforeEach(() => {
  vi.resetAllMocks();
});

describe("NotificationStorageQueueAdapter#deleteInstallation", () => {
  const adapter = new NotificationStorageQueueAdapter(
    mocks.queueClient as unknown as QueueClient,
  );
  it("sends the Base64-encoded delete-installation message and returns ok", async () => {
    mocks.queueClient.sendMessage.mockResolvedValue({ errorCode: undefined });

    const result = await adapter.deleteInstallation(MOCKED_FISCAL_CODE);

    expect(result.isOk()).toBe(true);
    expect(mocks.Hash.sha256).toHaveBeenCalledWith(MOCKED_FISCAL_CODE);
    expect(mocks.Base64.encode).toHaveBeenCalledWith({
      installationId: mocks.HASHED_INSTALLATION_ID,
      kind: "DeleteInstallation",
    });
    expect(mocks.queueClient.sendMessage).toHaveBeenCalledWith(
      mocks.ENCODED_MESSAGE,
    );
  });

  it("returns a GenericError when Azure reports an error code", async () => {
    mocks.queueClient.sendMessage.mockResolvedValue({
      errorCode: "QueueNotFound",
    });

    const result = await adapter.deleteInstallation(MOCKED_FISCAL_CODE);

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toBeInstanceOf(GenericError);
    expect(result._unsafeUnwrapErr().message).toMatch(
      /Failed to send delete installation message: QueueNotFound$/,
    );
  });

  it("returns a GenericError when sending the message rejects with an Error", async () => {
    mocks.queueClient.sendMessage.mockRejectedValue(
      new Error("Connection refused"),
    );

    const result = await adapter.deleteInstallation(MOCKED_FISCAL_CODE);

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toBeInstanceOf(GenericError);
    expect(result._unsafeUnwrapErr().message).toMatch(
      /Failed to send delete installation message: Connection refused$/,
    );
  });

  it("converts non-Error rejections into a GenericError", async () => {
    mocks.queueClient.sendMessage.mockRejectedValue("Unexpected failure");

    const result = await adapter.deleteInstallation(MOCKED_FISCAL_CODE);

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().message).toMatch(
      /Failed to send delete installation message: Unexpected failure$/,
    );
  });
});
