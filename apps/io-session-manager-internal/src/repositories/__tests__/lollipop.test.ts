import { describe, expect, beforeEach, vi, it } from "vitest";
import * as E from "fp-ts/Either";
import { RevokeAssertionRefInfo } from "@pagopa/io-functions-commons/dist/src/entities/revoke_assertion_ref_info";
import { QueueSendMessageResponse } from "@azure/storage-queue";
import { base64EncodeObject } from "../../utils/encoding";
import {
  mockQueueClient,
  mockSendMessage,
} from "../../__mocks__/queue-client.mock";
import { LollipopRepository } from "../lollipop";
import { anAssertionRef } from "../../__mocks__/user.mock";

describe("Lollipop repository#fireAndForgetRevokeAssertionRef", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  const expectedMessage = base64EncodeObject(
    RevokeAssertionRefInfo.encode({ assertion_ref: anAssertionRef }),
  );
  const mockedDependencies = {
    RevokeAssertionRefQueueClient: mockQueueClient,
  };
  it("should enqueue the message and return the expected response", async () => {
    const expectedResponse = {
      messageId: "aMessageId",
      requestId: "aRequestId",
    } as unknown as QueueSendMessageResponse;
    mockSendMessage.mockResolvedValueOnce(expectedResponse);

    const result =
      await LollipopRepository.fireAndForgetRevokeAssertionRef(anAssertionRef)(
        mockedDependencies,
      )();

    expect(mockSendMessage).toBeCalledWith(expectedMessage);
    expect(mockSendMessage).toHaveResolvedWith(expectedResponse);
    expect(result).toEqual(E.right(true));
  });

  it("should returns an error if the queue client throws", async () => {
    const expectedError = new Error("Network Error");
    mockSendMessage.mockRejectedValueOnce(expectedError);

    const result =
      await LollipopRepository.fireAndForgetRevokeAssertionRef(anAssertionRef)(
        mockedDependencies,
      )();
    expect(mockSendMessage).toBeCalledWith(expectedMessage);

    // fire and forget behaviour
    expect(result).toEqual(E.right(true));
  });
});
