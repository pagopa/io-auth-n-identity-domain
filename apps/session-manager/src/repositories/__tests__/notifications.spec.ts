import { describe, test, expect, beforeEach, vi } from "vitest";
import * as TE from "fp-ts/TaskEither";
import { pipe } from "fp-ts/lib/function";
import * as E from "fp-ts/Either";
import { sha256 } from "@pagopa/io-functions-commons/dist/src/utils/crypto";
import {
  mockQueueClient,
  mockSendMessage,
} from "../../__mocks__/repositories/queue-client.mocks";

import { base64EncodeObject } from "../../utils/encoding";
import { aFiscalCode } from "../../__mocks__/user.mocks";
import { KindEnum as DeleteKind } from "../../types/notifications";
import { NotificationMessageKindEnum } from "../../types/notifications";
import { deleteInstallation } from "../notifications";

describe("NotificationsRepo#deleteInstallation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  const expectedMessage = base64EncodeObject({
    installationId: sha256(aFiscalCode),
    kind: DeleteKind[NotificationMessageKindEnum.DeleteInstallation],
  });
  test("should enqueue the message and return the expected response", async () => {
    const expectedResponse = {
      messageId: "aMessageId",
      requestId: "aRequestId",
    };
    mockSendMessage.mockResolvedValueOnce(expectedResponse);
    const result = await pipe(
      deleteInstallation(aFiscalCode)({
        notificationQueueClient: mockQueueClient,
      }),
      TE.map((value) => expect(value).toEqual(expectedResponse)),
    )();
    expect(mockSendMessage).toBeCalledWith(expectedMessage);
    expect(E.isRight(result)).toBeTruthy();
  });

  test("should returns an error if the queue client throws", async () => {
    const expectedError = new Error("Network Error");
    mockSendMessage.mockRejectedValue(expectedError);
    const result = await pipe(
      deleteInstallation(aFiscalCode)({
        notificationQueueClient: mockQueueClient,
      }),
      TE.mapLeft((value) => expect(value).toEqual(expectedError)),
    )();

    expect(mockSendMessage).toBeCalledWith(expectedMessage);
    expect(E.isLeft(result)).toBeTruthy();
  });
});
