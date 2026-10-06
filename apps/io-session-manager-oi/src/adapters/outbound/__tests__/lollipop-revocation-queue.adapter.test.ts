import type { QueueClient } from "@azure/storage-queue";
import { GenericError } from "@pagopa/hexagonal-core";
import { LollipopAssertionRefSchema } from "@pagopa/io-auth-n-identity-domain";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LollipopRevocationQueueAdapter } from "../lollipop-revocation-queue.adapter.js";

const assertionRef = LollipopAssertionRefSchema.parse(
  "sha256-p1NafwcgIu9Iac3hOVdCzOWjTPwqvNRUNl6hkgTZWys",
);

const queueClient = {
  sendMessage: vi.fn(),
  getProperties: vi.fn(),
};

const adapter = new LollipopRevocationQueueAdapter(
  queueClient as unknown as QueueClient,
);

beforeEach(() => {
  vi.resetAllMocks();
});

describe("LollipopRevocationQueueAdapter#requestRevocation", () => {
  it("sends the Base64-encoded assertion reference and returns ok", async () => {
    queueClient.sendMessage.mockResolvedValueOnce({ errorCode: undefined });

    const result = await adapter.requestRevocation(assertionRef);

    expect(result.isOk()).toBe(true);
    expect(queueClient.sendMessage).toHaveBeenCalledExactlyOnceWith(
      Buffer.from(assertionRef).toString("base64"),
    );
  });

  it("returns GenericError when Azure reports an error code", async () => {
    queueClient.sendMessage.mockResolvedValueOnce({
      errorCode: "QueueNotFound",
    });

    const result = await adapter.requestRevocation(assertionRef);

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toEqual(
      new GenericError("Failed to request Lollipop revocation: QueueNotFound"),
    );
  });

  it("converts a rejected send to GenericError", async () => {
    queueClient.sendMessage.mockRejectedValueOnce(
      new Error("Connection refused"),
    );

    const result = await adapter.requestRevocation(assertionRef);

    expect(result._unsafeUnwrapErr()).toEqual(
      new GenericError(
        "Failed to request Lollipop revocation: Connection refused",
      ),
    );
  });

  it("converts a non-Error rejection to GenericError", async () => {
    queueClient.sendMessage.mockRejectedValueOnce("Unexpected failure");

    const result = await adapter.requestRevocation(assertionRef);

    expect(result._unsafeUnwrapErr()).toEqual(
      new GenericError(
        "Failed to request Lollipop revocation: Unexpected failure",
      ),
    );
  });
});

describe("LollipopRevocationQueueAdapter#healthcheck", () => {
  it("returns ok when queue properties are retrieved", async () => {
    queueClient.getProperties.mockResolvedValueOnce({});

    const result = await adapter.healthcheck();

    expect(result.isOk()).toBe(true);
    expect(queueClient.getProperties).toHaveBeenCalledExactlyOnceWith();
  });

  it("returns GenericError when retrieving queue properties fails", async () => {
    queueClient.getProperties.mockRejectedValueOnce(
      new Error("Queue unavailable"),
    );

    const result = await adapter.healthcheck();

    expect(result._unsafeUnwrapErr()).toEqual(
      new GenericError(
        "Failed to perform healthcheck on notification queue: Queue unavailable",
      ),
    );
  });
});
