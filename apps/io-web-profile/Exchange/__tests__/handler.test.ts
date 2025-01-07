import {
  FiscalCode,
  IPString,
  NonEmptyString
} from "@pagopa/ts-commons/lib/strings";
import { config as mockedConfig } from "../../__mocks__/config.mock";
import { MagicLinkPayload } from "../../utils/exchange-jwt";
import { exchangeHandler } from "../handler";
import { Context } from "@azure/functions";
import * as auditLog from "../../utils/audit-log";
import * as O from "fp-ts/Option";
import {
  BlobServiceClient,
  BlockBlobUploadResponse,
  RestError
} from "@azure/storage-blob";
import * as TE from "fp-ts/TaskEither";

// #region mocks
const aValidUser: MagicLinkPayload = {
  family_name: "family_name" as NonEmptyString,
  fiscal_number: "ISPXNB32R82Y766D" as FiscalCode,
  name: "name" as NonEmptyString,
  jti: "AAAA" as NonEmptyString,
  iat: 123456789
};
// #endregion
let context: Context;

beforeEach(() => {
  context = ({ log: jest.fn() } as unknown) as Context;
});

const containerClient = BlobServiceClient.fromConnectionString(
  mockedConfig.AUDIT_LOG_CONNECTION_STRING
).getContainerClient(mockedConfig.AUDIT_LOG_CONTAINER);

// #region tests
describe("Exchange", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test(`GIVEN a valid magic_link JWT
        WHEN all checks passed
        THEN the response is 200 and contains the exchange JWT`, async () => {
    const mockAuditLog = jest
      .spyOn(auditLog, "storeAuditLog")
      .mockReturnValueOnce(TE.right({} as BlockBlobUploadResponse));

    const handler = exchangeHandler(mockedConfig, containerClient);
    const response = await handler(
      aValidUser,
      context,
      O.some("127.0.0.1" as IPString)
    );
    expect(mockAuditLog).toHaveBeenCalledTimes(1);
    expect(response).toMatchObject({
      kind: "IResponseSuccessJson",
      value: { jwt: expect.stringMatching(`[A-Za-z0-9-_]{1,520}`) }
    });
  });

  test(`GIVEN a valid magic_link JWT
        WHEN auditlog saving data failed
        THEN the response is 500`, async () => {
    const mockAuditLog = jest
      .spyOn(auditLog, "storeAuditLog")
      .mockReturnValueOnce(TE.left(("" as unknown) as RestError));

    const handler = exchangeHandler(mockedConfig, containerClient);
    const response = await handler(
      aValidUser,
      context,
      O.some("127.0.0.1" as IPString)
    );
    expect(mockAuditLog).toHaveBeenCalledTimes(1);
    expect(response).toMatchObject({
      kind: "IResponseErrorInternal"
    });
  });
});
// #endregion
