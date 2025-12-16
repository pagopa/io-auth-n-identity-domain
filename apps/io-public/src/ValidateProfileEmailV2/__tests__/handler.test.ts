/* eslint-disable max-lines-per-function */
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as express from "express";

import { TableClient } from "@azure/data-tables";
import { Context as FunctionContext } from "@azure/functions";
import { ProfileModel } from "@pagopa/io-functions-commons/dist/src/models/profile";
import { IProfileEmailReader } from "@pagopa/io-functions-commons/dist/src/utils/unique_email_enforcement";
import { EmailString, FiscalCode } from "@pagopa/ts-commons/lib/strings";
import * as O from "fp-ts/Option";
import * as TE from "fp-ts/TaskEither";
import {
  aFiscalCode,
  aRetrievedProfile,
  anEmail
} from "../../__mocks__/profile";
import { StatusEnum } from "../../generated/definitions/external/GetTokenInfoResponse";
import { FlowTypeEnum, TokenParam } from "../../utils/middleware";
import {
  GetTokenInfo,
  ValidateProfileEmail,
  ValidateProfileEmailHandler
} from "../handler";

const TOKEN_ID = "01DPT9QAZ6N0FJX21A86FRCWB3";
const TOKEN_VALIDATOR = "8c652f8566ba53bd8cf0b1b9";
const TOKEN_VALIDATOR_HASH =
  "026c47ead971b9af13353f5d5e563982ebca542f8df3246bdaf1f86e16075072";
const VALIDATION_TOKEN = `${TOKEN_ID}:${TOKEN_VALIDATOR}` as TokenParam;
const GENRIC_ERROR_DETAIL = "Internal server error: GENERIC_ERROR";
const INVALID_TOKEN_ERROR_DETAIL = "Unauthorized: INVALID_TOKEN";

const mockFindLastVersionByModelId = vi
  .fn()
  .mockImplementation(() =>
    TE.right(O.some({ ...aRetrievedProfile, isEmailValidated: false }))
  );
const mockUpdate = vi
  .fn()
  .mockImplementation(() => TE.right(aRetrievedProfile));
const mockProfileModel = ({
  findLastVersionByModelId: mockFindLastVersionByModelId,
  update: mockUpdate
} as unknown) as ProfileModel;

const contextMock = ({
  log: {
    error: vi.fn(),
    verbose: vi.fn()
  }
} as unknown) as FunctionContext;

const aRetrievedEntity = {
  Email: anEmail,
  FiscalCode: aFiscalCode,
  InvalidAfter: new Date(Date.now() + 1000 * 1000).toISOString(),
  partitionKey: "01DPT9QAZ6N0FJX21A86FRCWB3",
  rowKey: "026c47ead971b9af13353f5d5e563982ebca542f8df3246bdaf1f86e16075072"
};

const mockRetrieveEntity = vi.fn().mockResolvedValue(aRetrievedEntity);

const tableClientMock = ({
  getEntity: mockRetrieveEntity
} as unknown) as TableClient;

function generateProfileEmails(
  count: number,
  throws: boolean = false,
  fiscalCode: FiscalCode = "X" as FiscalCode
) {
  return async function*(email: EmailString) {
    if (throws) {
      throw new Error("error retriving profile emails");
    }
    // eslint-disable-next-line functional/no-let
    for (let i = 0; i < count; i++) {
      yield { email, fiscalCode };
    }
  };
}

const profileEmailReader: IProfileEmailReader = {
  list: generateProfileEmails(0)
};

const expiredTokenEntity = {
  Email: anEmail,
  FiscalCode: aFiscalCode,
  InvalidAfter: new Date(Date.now() - 1000 * 1000).toISOString(),
  partitionKey: "01DPT9QAZ6N0FJX21A86FRCWB3",
  rowKey: "026c47ead971b9af13353f5d5e563982ebca542f8df3246bdaf1f86e16075072"
};

describe("ValidateProfileEmailHandler Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Flow types:
  // CONFIRM -> verify token and on success redirect to confirm page
  // VALIDATE -> verify token and on success update the user data and redirect to result page
  describe.each`
    isConfirmFlow
    ${true}
    ${false}
  `("ValidateProfileEmailHandler#TableStorage Errors", ({ isConfirmFlow }) => {
    it.each`
      scenario                                                                                 | expectedResponse                                                                                                   | expectedLog                           | retrieveResult                   | isApiError
      ${"GENERIC_ERROR in case the query versus the table storage fails"}                      | ${{ kind: "IResponseErrorInternal", detail: GENRIC_ERROR_DETAIL }}                                                 | ${"Error searching validation token"} | ${new Error("error Retrieving")} | ${true}
      ${"GENERIC_ERROR in case the entity retrieved does not comply with the expected format"} | ${{ kind: "IResponseErrorInternal", detail: GENRIC_ERROR_DETAIL }}                                                 | ${"Error searching validation token"} | ${{ bad: "prop" }}               | ${false}
      ${"INVALID_TOKEN error in case the token if not found in the table"}                     | ${{ kind: "IResponseErrorUnauthorized", detail: INVALID_TOKEN_ERROR_DETAIL }}                                      | ${"Validation token not found"}       | ${{ statusCode: 404 }}           | ${true}
      ${"TOKEN_EXPIRED error in case the token is expired"}                                    | ${{ kind: "IResponseSuccessJson", value: { profile_email: anEmail, reason: "TOKEN_EXPIRED", status: "FAILURE" } }} | ${"Token expired"}                    | ${expiredTokenEntity}            | ${false}
    `(
      "should return a redirect with a $scenario",
      async ({ retrieveResult, expectedResponse, expectedLog, isApiError }) => {
        if (isApiError) {
          mockRetrieveEntity.mockRejectedValueOnce(retrieveResult);
        } else {
          mockRetrieveEntity.mockResolvedValueOnce(retrieveResult);
        }

        const verifyProfileEmailHandler = ValidateProfileEmailHandler({
          tableClient: tableClientMock,
          profileModel: mockProfileModel,
          profileEmails: profileEmailReader,
          flow: isConfirmFlow ? FlowTypeEnum.CONFIRM : FlowTypeEnum.VALIDATE
        });

        const response = await verifyProfileEmailHandler(
          contextMock,
          VALIDATION_TOKEN
        );

        expect(response).toEqual(
          expect.objectContaining({
            ...expectedResponse
          })
        );

        expect(vi.mocked(contextMock.log.error).mock.calls[0][0]).toEqual(
          expect.stringContaining(expectedLog)
        );

        expect(mockRetrieveEntity).toBeCalledWith(
          TOKEN_ID,
          TOKEN_VALIDATOR_HASH,
          undefined
        );
        expect(mockFindLastVersionByModelId).not.toBeCalled();
        expect(mockUpdate).not.toBeCalled();
      }
    );
  });

  describe.each`
    isConfirmFlow
    ${true}
    ${false}
  `(
    "ValidateProfileEmailHandler#UniqueEmailEnforcement Errors",
    ({ isConfirmFlow }) => {
      it.each`
        scenario                                                                   | expectedResponse                                                                                                         | isThrowing
        ${"EMAIL_ALREADY_TAKEN if the e-mail is already taken"}                    | ${{ kind: "IResponseSuccessJson", value: { profile_email: anEmail, reason: "EMAIL_ALREADY_TAKEN", status: "FAILURE" } }} | ${undefined}
        ${"IResponseErrorInternal WHEN the unique e-mail enforcement check fails"} | ${{ kind: "IResponseErrorInternal", detail: GENRIC_ERROR_DETAIL }}                                                       | ${true}
      `("should return $scenario", async ({ expectedResponse, isThrowing }) => {
        const verifyProfileEmailHandler = ValidateProfileEmailHandler({
          tableClient: tableClientMock,
          profileModel: mockProfileModel,
          profileEmails: {
            list: generateProfileEmails(1, isThrowing)
          },
          flow: isConfirmFlow ? FlowTypeEnum.CONFIRM : FlowTypeEnum.VALIDATE
        });

        const response = await verifyProfileEmailHandler(
          contextMock,
          VALIDATION_TOKEN
        );

        expect(response).toEqual(
          expect.objectContaining({
            ...expectedResponse
          })
        );

        expect(mockRetrieveEntity).toHaveBeenCalledExactlyOnceWith(
          TOKEN_ID,
          TOKEN_VALIDATOR_HASH,
          undefined
        );
        expect(mockFindLastVersionByModelId).toHaveBeenCalledExactlyOnceWith([
          aFiscalCode
        ]);
        expect(mockUpdate).not.toBeCalled();
      });
    }
  );

  describe.each`
    isConfirmFlow
    ${true}
    ${false}
  `("ValidateProfileEmailHandler# Get Profile Errors", ({ isConfirmFlow }) => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it.each`
      scenario                                                                       | expectedResponse                                                              | getProfileResult
      ${"IResponseErrorInternal on error obtaining profile"}                         | ${{ kind: "IResponseErrorInternal", detail: GENRIC_ERROR_DETAIL }}            | ${TE.left(new Error("error obtaining profile"))}
      ${"IResponseErrorInternal on profile not found"}                               | ${{ kind: "IResponseErrorInternal", detail: GENRIC_ERROR_DETAIL }}            | ${TE.right(O.none)}
      ${"IResponseErrorUnauthorized if the Email differs between token and profile"} | ${{ kind: "IResponseErrorUnauthorized", detail: INVALID_TOKEN_ERROR_DETAIL }} | ${TE.right(O.some({ ...aRetrievedProfile, email: "different@email.test" }))}
    `(
      "should return $scenario",
      async ({ expectedResponse, getProfileResult }) => {
        mockFindLastVersionByModelId.mockImplementationOnce(
          () => getProfileResult
        );

        const verifyProfileEmailHandler = ValidateProfileEmailHandler({
          tableClient: tableClientMock,
          profileModel: mockProfileModel,
          profileEmails: profileEmailReader,
          flow: isConfirmFlow ? FlowTypeEnum.CONFIRM : FlowTypeEnum.VALIDATE
        });

        const response = await verifyProfileEmailHandler(
          contextMock,
          VALIDATION_TOKEN
        );

        expect(response).toEqual(expect.objectContaining(expectedResponse));

        expect(mockRetrieveEntity).toHaveBeenCalledExactlyOnceWith(
          TOKEN_ID,
          TOKEN_VALIDATOR_HASH,
          undefined
        );
        expect(mockFindLastVersionByModelId).toHaveBeenCalledExactlyOnceWith([
          aFiscalCode
        ]);
        expect(mockUpdate).not.toBeCalled();
      }
    );
  });

  it("should return IResponseErrorInternal on update profile failure", async () => {
    mockUpdate.mockImplementationOnce(() => TE.left(new Error("update error")));

    const verifyProfileEmailHandler = ValidateProfileEmailHandler({
      tableClient: tableClientMock,
      profileModel: mockProfileModel,
      profileEmails: profileEmailReader,
      flow: FlowTypeEnum.CONFIRM
    });
    const response = await verifyProfileEmailHandler(
      contextMock,
      VALIDATION_TOKEN
    );

    expect(response).toEqual(
      expect.objectContaining({
        kind: "IResponseErrorInternal",
        detail: GENRIC_ERROR_DETAIL
      })
    );

    expect(mockRetrieveEntity).toHaveBeenCalledExactlyOnceWith(
      TOKEN_ID,
      TOKEN_VALIDATOR_HASH,
      undefined
    );
    expect(mockFindLastVersionByModelId).toHaveBeenCalledExactlyOnceWith([
      aFiscalCode
    ]);
    expect(mockUpdate).toHaveBeenCalledOnce();
  });

  it("should reutrn the email associated with the token we are validating", async () => {
    const verifyProfileEmailHandler = ValidateProfileEmailHandler({
      tableClient: tableClientMock,
      profileModel: mockProfileModel,
      profileEmails: profileEmailReader,
      flow: FlowTypeEnum.VALIDATE
    });

    const response = await verifyProfileEmailHandler(
      contextMock,
      VALIDATION_TOKEN
    );

    expect(response).toEqual(
      expect.objectContaining({
        kind: "IResponseSuccessJson",
        value: {
          status: StatusEnum.SUCCESS,
          profile_email: anEmail
        }
      })
    );
    expect(mockRetrieveEntity).toHaveBeenCalledExactlyOnceWith(
      TOKEN_ID,
      TOKEN_VALIDATOR_HASH,
      undefined
    );
    expect(mockFindLastVersionByModelId).toHaveBeenCalledExactlyOnceWith([
      aFiscalCode
    ]);
    expect(mockUpdate).not.toBeCalled();
  });

  it("should reutrn the email associated with the token we are confirming", async () => {
    const verifyProfileEmailHandler = ValidateProfileEmailHandler({
      tableClient: tableClientMock,
      profileModel: mockProfileModel,
      profileEmails: profileEmailReader,
      flow: FlowTypeEnum.CONFIRM
    });
    const response = await verifyProfileEmailHandler(
      contextMock,
      VALIDATION_TOKEN
    );

    expect(response).toEqual(
      expect.objectContaining({
        kind: "IResponseSuccessJson",
        value: {
          status: StatusEnum.SUCCESS
        }
      })
    );
    expect(mockRetrieveEntity).toHaveBeenCalledExactlyOnceWith(
      TOKEN_ID,
      TOKEN_VALIDATOR_HASH,
      undefined
    );
    expect(mockFindLastVersionByModelId).toHaveBeenCalledExactlyOnceWith([
      aFiscalCode
    ]);
    expect(mockUpdate).toHaveBeenCalledExactlyOnceWith({
      ...aRetrievedProfile,
      isEmailValidated: true
    });
  });
});

describe("Controller Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createMockResponse = () => {
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis()
    };
    return (res as unknown) as express.Response;
  };

  const createMockRequest = (overrides: Partial<express.Request> = {}) =>
    (({
      app: {
        get: vi.fn().mockReturnValue(contextMock)
      },
      ...overrides
    } as unknown) as express.Request);

  it.each`
    scenario                           | requestHeaders                                                          | expectedResponse                                                                 | expectedResultCode
    ${"200 on well shaped request"}    | ${{ headers: { "x-pagopa-email-validation-token": VALIDATION_TOKEN } }} | ${{ status: StatusEnum.SUCCESS, profile_email: anEmail }}                        | ${200}
    ${"400 on missing token header"}   | ${{ headers: {} }}                                                      | ${{ title: expect.stringContaining("Invalid string that matches the pattern") }} | ${400}
    ${"400 on malformed token header"} | ${{ headers: { "x-pagopa-email-validation-token": "aBadToken" } }}      | ${{ title: expect.stringContaining("Invalid string that matches the pattern") }} | ${400}
  `(
    "GetTokenInfo should return $scenario",
    async ({ requestHeaders, expectedResponse, expectedResultCode }) => {
      const handler = GetTokenInfo(
        tableClientMock,
        mockProfileModel,
        profileEmailReader
      );

      const mockReq = createMockRequest({
        ...requestHeaders
      });

      const mockRes = createMockResponse();

      const nextFn = vi.fn();

      await handler(mockReq, mockRes, nextFn);

      expect(mockRes.status).toHaveBeenCalledWith(expectedResultCode);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining(expectedResponse)
      );
    }
  );

  it.each`
    scenario                           | requestHeaders                           | expectedResponse                                    | expectedResultCode
    ${"200 on well shaped request"}    | ${{ body: { token: VALIDATION_TOKEN } }} | ${{ status: StatusEnum.SUCCESS }}                   | ${200}
    ${"400 on missing token header"}   | ${{ body: {} }}                          | ${{ title: "Invalid ValidateProfileEmailPayload" }} | ${400}
    ${"400 on malformed token header"} | ${{ body: { token: "aBadToken" } }}      | ${{ title: "Invalid ValidateProfileEmailPayload" }} | ${400}
  `(
    "ValidateProfileEmail should return $scenario",
    async ({ requestHeaders, expectedResponse, expectedResultCode }) => {
      const handler = ValidateProfileEmail(
        tableClientMock,
        mockProfileModel,
        profileEmailReader
      );

      const mockReq = createMockRequest({
        ...requestHeaders
      });

      const mockRes = createMockResponse();

      const nextFn = vi.fn();

      await handler(mockReq, mockRes, nextFn);

      expect(mockRes.status).toHaveBeenCalledWith(expectedResultCode);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining(expectedResponse)
      );
    }
  );
});
