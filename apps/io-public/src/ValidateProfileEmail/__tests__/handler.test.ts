import { beforeEach, describe, expect, it, vi } from "vitest";

import { ResourceNotFoundCode } from "@pagopa/io-functions-commons/dist/src/utils/azure_storage";

import { EmailString, FiscalCode } from "@pagopa/ts-commons/lib/strings";
import { IProfileEmailReader } from "@pagopa/io-functions-commons/dist/src/utils/unique_email_enforcement";
import * as TE from "fp-ts/TaskEither";
import * as O from "fp-ts/Option";
import { ProfileModel } from "@pagopa/io-functions-commons/dist/src/models/profile";
import { ValidUrl } from "@pagopa/ts-commons/lib/url";
import { aFiscalCode, aRetrievedProfile, anEmail } from "../__mocks__/profile";
import { ValidateProfileEmailHandler } from "../handler";
import { FlowTypeEnum, TokenQueryParam } from "../../utils/middleware";
import {
  confirmChoicePageUrl,
  validationFailureUrl,
  validationSuccessUrl
} from "../../utils/redirect_url";

const VALIDATION_TOKEN = "01DPT9QAZ6N0FJX21A86FRCWB3:8c652f8566ba53bd8cf0b1b9" as TokenQueryParam;

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

const contextMock = {
  log: {
    error: vi.fn(),
    verbose: vi.fn()
  }
};

const validationCallbackUrl = {
  href: "localhost/validation"
} as ValidUrl;

const confirmValidationUrl = {
  href: "localhost/confirm-choice"
} as ValidUrl;

const emailValidationUrls = { confirmValidationUrl, validationCallbackUrl };

const mockRetrieveEntity = vi.fn().mockResolvedValue({
  Email: anEmail,
  FiscalCode: aFiscalCode,
  InvalidAfter: new Date(Date.now() + 1000 * 1000).toISOString(),
  partitionKey: "01DPT9QAZ6N0FJX21A86FRCWB3",
  rowKey: "026c47ead971b9af13353f5d5e563982ebca542f8df3246bdaf1f86e16075072"
});

const tableClientMock = {
  getEntity: mockRetrieveEntity
};

function generateProfileEmails(
  count: number,
  throws: boolean = false,
  fiscalCode: FiscalCode = "X" as FiscalCode
) {
  return async function*(email: EmailString) {
    if (throws) {
      throw new Error("error retriving profile emails");
    }
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
    scenario                                                             | expectedError      | retrieveResult                    | isApiError
    ${"GENERIC_ERROR in case the query versus the table storage fails"}  | ${"GENERIC_ERROR"} | ${new Error()}                    | ${true}
    ${"INVALID_TOKEN error in case the token if not found in the table"} | ${"INVALID_TOKEN"} | ${{ code: ResourceNotFoundCode }} | ${true}
    ${"TOKEN_EXPIRED error in case the token is expired"}                | ${"TOKEN_EXPIRED"} | ${expiredTokenEntity}             | ${false}
  `(
    "should return a redirect with a $scenario",
    async ({ retrieveResult, expectedError, isApiError }) => {
      isApiError
        ? mockRetrieveEntity.mockRejectedValueOnce(retrieveResult)
        : mockRetrieveEntity.mockResolvedValueOnce(retrieveResult);

      const verifyProfileEmailHandler = ValidateProfileEmailHandler(
        tableClientMock as any,
        mockProfileModel,
        emailValidationUrls,
        profileEmailReader
      );

      const response = await verifyProfileEmailHandler(
        contextMock as any,
        VALIDATION_TOKEN,
        isConfirmFlow ? FlowTypeEnum.CONFIRM : FlowTypeEnum.VALIDATE
      );

      expect(response.kind).toBe("IResponseSeeOtherRedirect");
      expect(response.detail).toBe(
        validationFailureUrl(validationCallbackUrl, expectedError).href
      );
      expect(mockFindLastVersionByModelId).not.toBeCalled();
      expect(mockUpdate).not.toBeCalled();
    }
  );

  it.each`
    scenario                                                                                                                                    | expectedError            | isThrowing
    ${"should return IResponseSeeOtherRedirect if the e-mail is already taken (unique email enforcement = %uee) WHEN a citizen changes e-mail"} | ${"EMAIL_ALREADY_TAKEN"} | ${undefined}
    ${"return 500 WHEN the unique e-mail enforcement check fails"}                                                                              | ${"GENERIC_ERROR"}       | ${true}
  `(
    "should $scenario",
    async ({ expectedError, isThrowing, isConfirmFlow }) => {
      const verifyProfileEmailHandler = ValidateProfileEmailHandler(
        tableClientMock as any,
        mockProfileModel,
        emailValidationUrls,
        {
          list: generateProfileEmails(1, isThrowing)
        }
      );

      const response = await verifyProfileEmailHandler(
        contextMock as any,
        VALIDATION_TOKEN,
        isConfirmFlow ? FlowTypeEnum.CONFIRM : FlowTypeEnum.VALIDATE
      );

      expect(response.kind).toBe("IResponseSeeOtherRedirect");
      expect(response.detail).toBe(
        validationFailureUrl(validationCallbackUrl, expectedError).href
      );
      expect(mockFindLastVersionByModelId).toBeCalledWith([aFiscalCode]);
      expect(mockUpdate).not.toBeCalled();
    }
  );
});

describe("ValidateProfileEmailHandler#Happy path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should validate the email in profile if all the condition are verified during VALIDATE flow", async () => {
    const verifyProfileEmailHandler = ValidateProfileEmailHandler(
      tableClientMock as any,
      mockProfileModel,
      emailValidationUrls,
      {
        list: generateProfileEmails(0)
      }
    );

    const response = await verifyProfileEmailHandler(
      contextMock as any,
      VALIDATION_TOKEN,
      FlowTypeEnum.VALIDATE
    );

    expect(response.kind).toBe("IResponseSeeOtherRedirect");
    expect(response.detail).toBe(
      validationSuccessUrl(validationCallbackUrl).href
    );
    expect(mockFindLastVersionByModelId).toBeCalledWith([aFiscalCode]);
    expect(mockUpdate).toBeCalledWith(
      expect.objectContaining({ isEmailValidated: true })
    );
  });

  it("should NOT validate the email in profile if we are in the CONFIRM flow", async () => {
    const verifyProfileEmailHandler = ValidateProfileEmailHandler(
      tableClientMock as any,
      mockProfileModel,
      emailValidationUrls,
      {
        list: generateProfileEmails(0)
      }
    );

    const response = await verifyProfileEmailHandler(
      contextMock as any,
      VALIDATION_TOKEN,
      FlowTypeEnum.CONFIRM
    );

    expect(response.kind).toBe("IResponseSeeOtherRedirect");
    expect(response.detail).toBe(
      confirmChoicePageUrl(confirmValidationUrl, VALIDATION_TOKEN, anEmail).href
    );
    expect(mockFindLastVersionByModelId).toBeCalledWith([aFiscalCode]);
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
