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
import { TokenQueryParam } from "../../utils/middleware";
import { GetTokenInfoHandler } from "../handler";

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

describe("ValidateProfileEmailHandler#Happy path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return the email associated with the token we are validating", async () => {
    const verifyProfileEmailHandler = GetTokenInfoHandler(
      tableClientMock,
      mockProfileModel,
      profileEmailReader
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

    expect(mockFindLastVersionByModelId).toBeCalledWith([aFiscalCode]);
  });
});
