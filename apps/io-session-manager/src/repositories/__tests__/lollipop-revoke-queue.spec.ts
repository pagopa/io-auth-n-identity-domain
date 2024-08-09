import { describe, test, expect, beforeEach, vi } from "vitest";
import { pipe } from "fp-ts/lib/function";
import * as E from "fp-ts/Either";
import { RevokeAssertionRefInfo } from "@pagopa/io-functions-commons/dist/src/entities/revoke_assertion_ref_info";
import { QueueSendMessageResponse } from "@azure/storage-queue";
import {
  mockQueueClient,
  mockSendMessage,
} from "../../__mocks__/repositories/queue-client.mocks";

import { revokePreviousAssertionRef } from "../lollipop-revoke-queue";
import { anAssertionRef } from "../../__mocks__/lollipop.mocks";
import { base64EncodeObject } from "../../utils/encoding";

describe("LollipopRevokeRepo#revokePreviousAssertionRef", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  const expectedMessage = base64EncodeObject(
    RevokeAssertionRefInfo.encode({ assertion_ref: anAssertionRef }),
  );
  const mockedDependencies = {
    lollipopRevokeQueueClient: mockQueueClient,
  };
  test("should enqueue the message and return the expected response", async () => {
    const expectedResponse = {
      messageId: "aMessageId",
      requestId: "aRequestId",
    } as unknown as QueueSendMessageResponse;
    mockSendMessage.mockResolvedValueOnce(expectedResponse);
    const result = await pipe(
      mockedDependencies,
      revokePreviousAssertionRef(anAssertionRef),
    )();
    expect(mockSendMessage).toBeCalledWith(expectedMessage);
    expect(result).toEqual(E.right(expectedResponse));
  });

  test("should returns an error if the queue client throws", async () => {
    const expectedError = new Error("Network Error");
    mockSendMessage.mockRejectedValue(expectedError);
    const result = await pipe(
      mockedDependencies,
      revokePreviousAssertionRef(anAssertionRef),
    )();

    expect(mockSendMessage).toBeCalledWith(expectedMessage);
    expect(result).toEqual(E.left(expectedError));
  });
});
