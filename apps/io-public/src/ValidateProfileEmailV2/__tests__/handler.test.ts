import { beforeEach, describe, expect, it, vi } from "vitest";

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
import { ValidateProfileEmailHandler } from "../handler";

const TOKEN_ID = "01DPT9QAZ6N0FJX21A86FRCWB3";
const TOKEN_VALIDATOR = "8c652f8566ba53bd8cf0b1b9";
const TOKEN_VALIDATOR_HASH =
  "026c47ead971b9af13353f5d5e563982ebca542f8df3246bdaf1f86e16075072";
const VALIDATION_TOKEN = `${TOKEN_ID}:${TOKEN_VALIDATOR}` as TokenParam;
const GENRIC_ERROR_DETAIL = "Internal server error: GENERIC_ERROR";

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

const mockRetrieveEntity = vi.fn().mockResolvedValue({
  Email: anEmail,
  FiscalCode: aFiscalCode,
  InvalidAfter: new Date(Date.now() + 1000 * 1000).toISOString(),
  partitionKey: "01DPT9QAZ6N0FJX21A86FRCWB3",
  rowKey: "026c47ead971b9af13353f5d5e563982ebca542f8df3246bdaf1f86e16075072"
});

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

// Flow types:
// CONFIRM -> verify token and on success redirect to confirm page
// VALIDATE -> verify token and on success update the user data and redirect to result page
describe.each`
  isConfirmFlow
  ${true}
  ${false}
`("ValidateProfileEmailHandler#Errors", ({ isConfirmFlow }) => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each`
    scenario                                                                                 | expectedResponseType        | expectedContent                                                                      | retrieveResult                   | isApiError
    ${"GENERIC_ERROR in case the query versus the table storage fails"}                      | ${"IResponseErrorInternal"} | ${{ detail: GENRIC_ERROR_DETAIL }}                                                   | ${new Error("error Retrieving")} | ${true}
    ${"GENERIC_ERROR in case the entity retrieved does not comply with the expected format"} | ${"IResponseErrorInternal"} | ${{ detail: GENRIC_ERROR_DETAIL }}                                                   | ${{ bad: "prop" }}               | ${false}
    ${"INVALID_TOKEN error in case the token if not found in the table"}                     | ${"IResponseErrorInternal"} | ${{ detail: GENRIC_ERROR_DETAIL }}                                                   | ${{ statusCode: 404 }}           | ${true}
    ${"TOKEN_EXPIRED error in case the token is expired"}                                    | ${"IResponseSuccessJson"}   | ${{ value: { profile_email: anEmail, reason: "TOKEN_EXPIRED", status: "FAILURE" } }} | ${expiredTokenEntity}            | ${false}
  `(
    "should return a redirect with a $scenario",
    async ({
      retrieveResult,
      expectedResponseType,
      expectedContent,
      isApiError
    }) => {
      if (isApiError) {
        mockRetrieveEntity.mockRejectedValueOnce(retrieveResult);
      } else {
        mockRetrieveEntity.mockResolvedValueOnce(retrieveResult);
      }

      const verifyProfileEmailHandler = ValidateProfileEmailHandler(
        tableClientMock,
        mockProfileModel,
        profileEmailReader,
        isConfirmFlow ? FlowTypeEnum.CONFIRM : FlowTypeEnum.VALIDATE
      );

      const response = await verifyProfileEmailHandler(
        contextMock,
        VALIDATION_TOKEN
      );

      expect(response).toEqual(
        expect.objectContaining({
          kind: expectedResponseType,
          ...expectedContent
        })
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

  it.each`
    scenario                                                              | expectedResponse                                                                                                         | isThrowing
    ${"should return EMAIL_ALREADY_TAKEN if the e-mail is already taken"} | ${{ kind: "IResponseSuccessJson", value: { profile_email: anEmail, reason: "EMAIL_ALREADY_TAKEN", status: "FAILURE" } }} | ${undefined}
    ${"return 500 WHEN the unique e-mail enforcement check fails"}        | ${{ kind: "IResponseErrorInternal", detail: GENRIC_ERROR_DETAIL }}                                                       | ${true}
  `(
    "should $scenario",
    async ({ expectedResponse, isThrowing, isConfirmFlow }) => {
      const verifyProfileEmailHandler = ValidateProfileEmailHandler(
        tableClientMock,
        mockProfileModel,
        {
          list: generateProfileEmails(1, isThrowing)
        },
        isConfirmFlow ? FlowTypeEnum.CONFIRM : FlowTypeEnum.VALIDATE
      );

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
    }
  );
});

describe("ValidateProfileEmailHandler#Happy path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should reutrn the email associated with the token we are validating", async () => {
    const verifyProfileEmailHandler = ValidateProfileEmailHandler(
      tableClientMock,
      mockProfileModel,
      profileEmailReader,
      FlowTypeEnum.VALIDATE
    );

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
    const verifyProfileEmailHandler = ValidateProfileEmailHandler(
      tableClientMock,
      mockProfileModel,
      profileEmailReader,
      FlowTypeEnum.CONFIRM
    );

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
