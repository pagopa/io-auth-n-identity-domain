import { describe, beforeEach, vi, it, expect } from "vitest";
import * as E from "fp-ts/lib/Either";
import { sha256 } from "@pagopa/io-functions-commons/dist/src/utils/crypto";
import {
  DeleteInstallationKindEnum,
  NotificationMessageKindEnum,
} from "../../types/notifications";
import { InstallationRepository } from "../installation";
import { base64EncodeObject } from "../../utils/encoding";
import {
  mockQueueClient,
  mockSendMessage,
} from "../../__mocks__/queue-client.mock";
import { aFiscalCode } from "../../__mocks__/user.mock";

describe("Installation repository#deleteInstallation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  const expectedMessage = base64EncodeObject({
    installationId: sha256(aFiscalCode),
    kind: DeleteInstallationKindEnum[
      NotificationMessageKindEnum.DeleteInstallation
    ],
  });
  it("should enqueue the message and return the expected response", async () => {
    const expectedResponse = {
      messageId: "aMessageId",
      requestId: "aRequestId",
    };
    mockSendMessage.mockResolvedValueOnce(expectedResponse);
    const result = await InstallationRepository.deleteInstallation(aFiscalCode)(
      {
        NotificationQueueClient: mockQueueClient,
      },
    )();
    expect(result).toEqual(E.right(expectedResponse));
    expect(mockSendMessage).toBeCalledWith(expectedMessage);
  });

  it("should returns an error if the queue client throws", async () => {
    const expectedError = new Error("Network Error");
    mockSendMessage.mockRejectedValue(expectedError);
    const result = await InstallationRepository.deleteInstallation(aFiscalCode)(
      {
        NotificationQueueClient: mockQueueClient,
      },
    )();

    expect(result).toEqual(E.left(expectedError));
    expect(mockSendMessage).toBeCalledWith(expectedMessage);
    expect(E.isLeft(result)).toBeTruthy();
  });
});
