import { describe, test, expect, vi, beforeEach, afterAll } from "vitest";
import { DOMParser } from "xmldom";
import * as O from "fp-ts/Option";
import { QueueClient } from "@azure/storage-queue";
import * as TE from "fp-ts/TaskEither";
import * as E from "fp-ts/Either";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import * as spidLogsRepo from "../../repositories/spid-logs";
import {
  aSAMLRequest,
  aSamlRequestId,
  getASAMLResponse,
} from "../../__mocks__/spid.mocks";
import {
  getFiscalNumberFromPayload,
  getRequestIDFromResponse,
  makeSpidLogCallback,
} from "../spid-logs";
import { LoginTypeEnum } from "../../types/fast-login";
import { aFiscalCode } from "../../__mocks__/user.mocks";

const aDOMSamlResponse = new DOMParser().parseFromString(
  getASAMLResponse(),
  "text/xml",
);

describe("SPID logs", () => {
  test("should get SPID request id from response", () => {
    const requestId = getRequestIDFromResponse(aDOMSamlResponse);
    expect(requestId).toEqual(O.some(aSamlRequestId));
  });

  test("should get SPID user's fiscal code from response", () => {
    const fiscalCode = getFiscalNumberFromPayload(aDOMSamlResponse);
    expect(fiscalCode).toEqual(O.some(aFiscalCode));
  });
});

describe("SpidLogController#makeSpidLogCallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterAll(() => {
    vi.restoreAllMocks();
  });
  const anIP = "127.0.0.0";
  const aSAMLResponse = getASAMLResponse();

  const mockSendSpidLogsMessage = vi.spyOn(spidLogsRepo, "sendSpidLogsMessage");
  mockSendSpidLogsMessage.mockImplementation(({ spidLogQueueClient }) =>
    TE.tryCatch(() => spidLogQueueClient.sendMessage(""), E.toError),
  );

  const mockSendMessage = vi.fn().mockImplementation(() => Promise.resolve());
  const mockQueueClient = {
    sendMessage: mockSendMessage,
  } as unknown as QueueClient;

  const getLoginTypeMock = vi.fn().mockReturnValue(LoginTypeEnum.LEGACY);

  /* test.each`
    finalLoginType
    ${LoginTypeEnum.LEGACY}
    ${LoginTypeEnum.LV}
  `(
    "should enqueue valid payload on SPID response when final login type is $finalLoginType",
    ({ finalLoginType }) => {

      getLoginTypeMock.mockReturnValueOnce(finalLoginType);

      makeSpidLogCallback({
        spidLogQueueClient: mockQueueClient,
        getLoginType: getLoginTypeMock,
      })(anIP, aSAMLRequest, getASAMLResponse(), {
        // NOTE: this is relevant for this test, only getLoginType result will be considered
        loginType: LoginTypeEnum.LEGACY,
      });
      expect(mockQueueClient.sendMessage).toHaveBeenCalled();

      const b64 = mockQueueClient.sendMessage.mock.calls[0][0];
      const val = JSON.parse(Buffer.from(b64, "base64").toString("binary"));

      expect(val).toMatchObject(
        expect.objectContaining({
          loginType: finalLoginType,
        }),
      );
    },
  ); */

  test("should enqueue valid payload on SPID response", async () => {
    const dependencies = {
      spidLogQueueClient: mockQueueClient,
      getLoginType: getLoginTypeMock,
    };
    makeSpidLogCallback(dependencies)(anIP, aSAMLRequest, getASAMLResponse());
    // Await that the async process is executed before check the mock calls.
    await new Promise((resolve) => setTimeout(() => resolve(""), 10));

    expect(mockSendSpidLogsMessage).toBeCalled();
    expect(mockSendSpidLogsMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        ...dependencies,
        spidLogMessage: expect.objectContaining({
          fiscalCode: aFiscalCode,
          ip: anIP,
          loginType: LoginTypeEnum.LEGACY,
          requestPayload: aSAMLRequest,
          responsePayload: aSAMLResponse,
        }),
      }),
    );
  });

  test("should NOT not enqueue invalid FiscalCode on SPID SAMLResponse", async () => {
    makeSpidLogCallback({
      spidLogQueueClient: mockQueueClient,
      getLoginType: getLoginTypeMock,
    })(
      anIP,
      aSAMLRequest,
      getASAMLResponse("invalid-fiscal-code" as FiscalCode),
    );
    // Await that the async process is executed before check the mock calls.
    await new Promise((resolve) => setTimeout(() => resolve(""), 10));

    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  test("should NOT enqueue invalid IP on SPID SAMLResponse", async () => {
    makeSpidLogCallback({
      spidLogQueueClient: mockQueueClient,
      getLoginType: getLoginTypeMock,
    })("X", aSAMLRequest, getASAMLResponse());
    // Await that the async process is executed before check the mock calls.
    await new Promise((resolve) => setTimeout(() => resolve(""), 10));

    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  test("should NOT enqueue undefined payload on SPID SAMLRequest", async () => {
    makeSpidLogCallback({
      spidLogQueueClient: mockQueueClient,
      getLoginType: getLoginTypeMock,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    })(anIP, undefined as any, getASAMLResponse());
    // Await that the async process is executed before check the mock calls.
    await new Promise((resolve) => setTimeout(() => resolve(""), 10));

    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  test("should NOT enqueue undefined payload on SPID SAMLResponse", async () => {
    makeSpidLogCallback({
      spidLogQueueClient: mockQueueClient,
      getLoginType: getLoginTypeMock,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    })(anIP, aSAMLRequest, undefined as any);
    // Await that the async process is executed before check the mock calls.
    await new Promise((resolve) => setTimeout(() => resolve(""), 10));

    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  test("should NOT enqueue invalid payload on SPID SAMLResponse", async () => {
    makeSpidLogCallback({
      spidLogQueueClient: mockQueueClient,
      getLoginType: getLoginTypeMock,
    })(anIP, aSAMLRequest, "RESPONSE");
    // Await that the async process is executed before check the mock calls.
    await new Promise((resolve) => setTimeout(() => resolve(""), 10));

    expect(mockSendMessage).not.toHaveBeenCalled();
  });
});