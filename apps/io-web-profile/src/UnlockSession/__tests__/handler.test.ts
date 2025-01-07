import * as E from "fp-ts/lib/Either";
import { FiscalCode } from "../../generated/definitions/fast-login/FiscalCode";
import { UnlockCode } from "../../generated/definitions/fast-login/UnlockCode";
import { HslJwtPayloadExtended } from "../../utils/middlewares/hsl-jwt-validation-middleware";
import { unlockSessionHandler } from "../handler";
import { SpidLevel } from "../../utils/enums/SpidLevels";
import { Client } from "../../generated/definitions/fast-login/client";
import { UnlockSessionData } from "../../generated/definitions/external/UnlockSessionData";
import { IPString, NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { config as mockedConfig } from "../../__mocks__/config.mock";
import { BlobServiceClient, BlockBlobUploadResponse, RestError } from "@azure/storage-blob";
import * as O from "fp-ts/Option";
import * as auditLog from "../../utils/audit-log";
import * as TE from "fp-ts/TaskEither";

// #region mocks
const unlockSessionMock = jest.fn(async () =>
  E.right({
    status: 204
  })
);
const fastLoginClientMock = ({
  unlockUserSession: unlockSessionMock
} as unknown) as Client<"ApiKeyAuth">;

const aValidL1User: HslJwtPayloadExtended = {
  family_name: "family_name" as NonEmptyString,
  fiscal_number: "ISPXNB32R82Y766D" as FiscalCode,
  name: "name" as NonEmptyString,
  spid_level: SpidLevel.L1,
  jti: "AAAA" as NonEmptyString,
  iat: 123456789
};

const aValidL2User: HslJwtPayloadExtended = {
  family_name: "family_name" as NonEmptyString,
  fiscal_number: "ISPXNB32R82Y766D" as FiscalCode,
  name: "name" as NonEmptyString,
  spid_level: SpidLevel.L2,
  jti: "AAAA" as NonEmptyString,
  iat: 123456789
};

const aValidL2Payload = {
  unlock_code: "123456789" as UnlockCode
};

const aValidL3User: HslJwtPayloadExtended = {
  family_name: "family_name" as NonEmptyString,
  fiscal_number: "ISPXNB32R82Y766D" as FiscalCode,
  name: "name" as NonEmptyString,
  spid_level: SpidLevel.L3,
  jti: "AAAA" as NonEmptyString,
  iat: 123456789
};

const aValidL3Payload: UnlockSessionData = {};

const containerClient = BlobServiceClient.fromConnectionString(
  mockedConfig.AUDIT_LOG_CONNECTION_STRING
).getContainerClient(mockedConfig.AUDIT_LOG_CONTAINER);

// #endregion

// #region tests
describe("UnlockSession", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test(`GIVEN a valid payload and a valid user decoded from JWT
        WHEN audit logfail
        THEN the response is 500`, async () => {
    const handler = unlockSessionHandler(fastLoginClientMock, containerClient);

    const mockAuditLog = jest
      .spyOn(auditLog, "storeAuditLog")
      .mockReturnValueOnce(TE.left({} as RestError));

    const res = await handler(aValidL2User, aValidL2Payload, O.some("127.0.0.1" as IPString));

    expect(unlockSessionMock).toHaveBeenCalledTimes(1);
    expect(mockAuditLog).toHaveBeenCalledTimes(1);
    expect(unlockSessionMock).toHaveBeenCalledWith({
      body: {
        fiscal_code: aValidL2User.fiscal_number,
        unlock_code: aValidL2Payload.unlock_code
      }
    });
    expect(res).toMatchObject({
      kind: "IResponseErrorInternal"
    });
  });

  test(`GIVEN a valid payload and a valid L2 user decoded from JWT
        WHEN all checks passed
        THEN the response is 204`, async () => {
    const handler = unlockSessionHandler(fastLoginClientMock, containerClient);

    const mockAuditLog = jest
      .spyOn(auditLog, "storeAuditLog")
      .mockReturnValueOnce(TE.right({} as BlockBlobUploadResponse));


    const res = await handler(aValidL2User, aValidL2Payload, O.some("127.0.0.1" as IPString));

    expect(unlockSessionMock).toHaveBeenCalledTimes(1);
    expect(mockAuditLog).toHaveBeenCalledTimes(1);
    expect(unlockSessionMock).toHaveBeenCalledWith({
      body: {
        fiscal_code: aValidL2User.fiscal_number,
        unlock_code: aValidL2Payload.unlock_code
      }
    });
    expect(res).toMatchObject({
      kind: "IResponseSuccessNoContent"
    });
  });

  test(`GIVEN a valid payload and a valid L3 user decoded from JWT
        WHEN all checks passed
        THEN the response is 204`, async () => {
    const handler = unlockSessionHandler(fastLoginClientMock, containerClient);

    const mockAuditLog = jest
      .spyOn(auditLog, "storeAuditLog")
      .mockReturnValueOnce(TE.right({} as BlockBlobUploadResponse));

    const res = await handler(aValidL3User, aValidL3Payload, O.some("127.0.0.1" as IPString));

    expect(unlockSessionMock).toHaveBeenCalledTimes(1);
    expect(mockAuditLog).toHaveBeenCalledTimes(1);

    expect(unlockSessionMock).toHaveBeenCalledWith({
      body: {
        fiscal_code: aValidL3User.fiscal_number,
        unlock_code: undefined
      }
    });
    expect(res).toMatchObject({
      kind: "IResponseSuccessNoContent"
    });
  });

  test(`GIVEN a valid payload and a valid L2 user decoded from JWT
        WHEN fast-login returns 403
        THEN the response is 403`, async () => {
    unlockSessionMock.mockResolvedValueOnce(E.right({ status: 403 }));
    const handler = unlockSessionHandler(fastLoginClientMock, containerClient);

    const res = await handler(aValidL2User, aValidL2Payload, O.some("127.0.0.1" as IPString));

    expect(unlockSessionMock).toHaveBeenCalledTimes(1);
    expect(unlockSessionMock).toHaveBeenCalledWith({
      body: {
        fiscal_code: aValidL2User.fiscal_number,
        unlock_code: aValidL2Payload.unlock_code
      }
    });
    expect(res).toMatchObject({
      kind: "IResponseErrorForbiddenNotAuthorized",
      detail: expect.stringContaining("Forbidden")
    });
  });

  test(`GIVEN a valid payload and a valid L2 user decoded from JWT
        WHEN fast-login returns 502
        THEN the response is 502`, async () => {
    unlockSessionMock.mockResolvedValueOnce(E.right({ status: 502 }));
    const handler = unlockSessionHandler(fastLoginClientMock, containerClient);

    const res = await handler(aValidL2User, aValidL2Payload, O.some("127.0.0.1" as IPString));

    expect(unlockSessionMock).toHaveBeenCalledTimes(1);
    expect(unlockSessionMock).toHaveBeenCalledWith({
      body: {
        fiscal_code: aValidL2User.fiscal_number,
        unlock_code: aValidL2Payload.unlock_code
      }
    });
    expect(res).toMatchObject({
      kind: "IResponseErrorBadGateway",
      detail: expect.stringContaining("Something gone wrong.")
    });
  });

  test(`GIVEN a valid payload and a valid L2 user decoded from JWT
        WHEN fast-login returns 504
        THEN the response is 504`, async () => {
    unlockSessionMock.mockResolvedValueOnce(E.right({ status: 504 }));
    const handler = unlockSessionHandler(fastLoginClientMock, containerClient);

    const res = await handler(aValidL2User, aValidL2Payload, O.some("127.0.0.1" as IPString));

    expect(unlockSessionMock).toHaveBeenCalledTimes(1);
    expect(unlockSessionMock).toHaveBeenCalledWith({
      body: {
        fiscal_code: aValidL2User.fiscal_number,
        unlock_code: aValidL2Payload.unlock_code
      }
    });
    expect(res).toMatchObject({
      kind: "IResponseErrorGatewayTimeout",
      detail: expect.stringContaining(
        `Server couldn't respond in time, try again.`
      )
    });
  });

  test(`GIVEN a valid payload and a valid L2 user decoded from JWT
        WHEN fast-login returns an error
        THEN the response is 500`, async () => {
    const errorStatus = 429;
    unlockSessionMock.mockResolvedValueOnce(E.right({ status: errorStatus }));
    const handler = unlockSessionHandler(fastLoginClientMock, containerClient);

    const res = await handler(aValidL2User, aValidL2Payload, O.some("127.0.0.1" as IPString));

    expect(unlockSessionMock).toHaveBeenCalledTimes(1);
    expect(unlockSessionMock).toHaveBeenCalledWith({
      body: {
        fiscal_code: aValidL2User.fiscal_number,
        unlock_code: aValidL2Payload.unlock_code
      }
    });
    expect(res).toMatchObject({
      kind: "IResponseErrorInternal",
      detail: expect.stringContaining(
        `Something gone wrong. Response Status: {${errorStatus}}`
      )
    });
  });

  test(`GIVEN a valid payload and a valid L2 user decoded from JWT
        WHEN fast-login doesn't respond
        THEN the response is 500`, async () => {
    unlockSessionMock.mockRejectedValueOnce("Error");
    const handler = unlockSessionHandler(fastLoginClientMock, containerClient);

    const res = await handler(aValidL2User, aValidL2Payload, O.some("127.0.0.1" as IPString));

    expect(unlockSessionMock).toHaveBeenCalledTimes(1);
    expect(unlockSessionMock).toHaveBeenCalledWith({
      body: {
        fiscal_code: aValidL2User.fiscal_number,
        unlock_code: aValidL2Payload.unlock_code
      }
    });
    expect(res).toMatchObject({
      kind: "IResponseErrorInternal",
      detail: expect.stringContaining("Error")
    });
  });

  test(`GIVEN a valid payload and a valid L1 user decoded from JWT
        WHEN checks don't pass
        THEN the response is 403`, async () => {
    const handler = unlockSessionHandler(fastLoginClientMock, containerClient);

    const res = await handler(aValidL1User, aValidL2Payload, O.some("127.0.0.1" as IPString));

    expect(unlockSessionMock).toHaveBeenCalledTimes(0);
    expect(res).toMatchObject({
      kind: "IResponseErrorForbiddenNotAuthorized",
      detail: expect.stringContaining(
        `Could not perform unlock-session. SpidLevel: {${SpidLevel.L1}}`
      )
    });
  });
});
// #endregion
