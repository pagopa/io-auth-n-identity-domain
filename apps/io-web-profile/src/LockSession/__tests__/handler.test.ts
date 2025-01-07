import * as E from "fp-ts/lib/Either";
import { aValidExchangeUser, aValidL2User } from "../../__mocks__/users";
import { UnlockCode } from "../../generated/definitions/fast-login/UnlockCode";
import { Client } from "../../generated/definitions/fast-login/client";
import { SpidLevel } from "../../utils/enums/SpidLevels";
import { HslJwtPayloadExtended } from "../../utils/middlewares/hsl-jwt-validation-middleware";
import { lockSessionHandler } from "../handler";
import { BlobServiceClient, BlockBlobUploadResponse, RestError } from "@azure/storage-blob";
import { config as mockedConfig } from "../../__mocks__/config.mock";
import { IPString } from "@pagopa/ts-commons/lib/strings";
import * as O from "fp-ts/Option";
import * as auditLog from "../../utils/audit-log";
import * as TE from "fp-ts/TaskEither";

// #region mocks
const lockSessionMock = jest.fn(async () =>
  E.right({
    status: 204
  })
);
const fastLoginClientMock = ({
  lockUserSession: lockSessionMock
} as unknown) as Client<"ApiKeyAuth">;

const aL1User: HslJwtPayloadExtended = {
  ...aValidL2User,
  spid_level: SpidLevel.L1
};

const aValidPayload = {
  unlock_code: "123456789" as UnlockCode
};

const containerClient = BlobServiceClient.fromConnectionString(
  mockedConfig.AUDIT_LOG_CONNECTION_STRING
).getContainerClient(mockedConfig.AUDIT_LOG_CONTAINER);
// #endregion

// #region tests
describe("LockSession", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test(`GIVEN a valid unlock_code in payload and a valid user decoded from JWT
        WHEN all checks passed
        THEN the response is 204`, async () => {
    const handler = lockSessionHandler(fastLoginClientMock, containerClient);

    const mockAuditLog = jest
      .spyOn(auditLog, "storeAuditLog")
      .mockReturnValueOnce(TE.right({} as BlockBlobUploadResponse));

    const res = await handler(aValidL2User, aValidPayload, O.some("127.0.0.1" as IPString));

    expect(lockSessionMock).toHaveBeenCalledTimes(1);
    expect(mockAuditLog).toHaveBeenCalledTimes(1);
    expect(lockSessionMock).toHaveBeenCalledWith({
      body: {
        fiscal_code: aValidL2User.fiscal_number,
        unlock_code: aValidPayload.unlock_code
      }
    });
    expect(res).toMatchObject({
      kind: "IResponseSuccessNoContent"
    });
  });

  test(`GIVEN a valid unlock_code in payload, a valid user decoded from JWT
        WHEN audit log fail
        THEN the response is 500`, async () => {
    const handler = lockSessionHandler(fastLoginClientMock, containerClient);

    const mockAuditLog = jest
      .spyOn(auditLog, "storeAuditLog")
      .mockReturnValueOnce(TE.left(("" as unknown) as RestError));

    const res = await handler(aValidL2User, aValidPayload, O.some("127.0.0.1" as IPString));

    expect(lockSessionMock).toHaveBeenCalledTimes(1);
    expect(mockAuditLog).toHaveBeenCalledTimes(1);
    expect(res).toMatchObject({
      kind: "IResponseErrorInternal"
    });
  });

  test(`GIVEN a valid unlock_code in payload, a valid user decoded from JWT
        WHEN fast-login response is 409
        THEN the response is 409`, async () => {
    lockSessionMock.mockResolvedValueOnce(E.right({ status: 409 }));
    const handler = lockSessionHandler(fastLoginClientMock, containerClient);
    const res = await handler(aValidL2User, aValidPayload, O.some("127.0.0.1" as IPString));

    expect(lockSessionMock).toHaveBeenCalledTimes(1);
    expect(lockSessionMock).toHaveBeenCalledWith({
      body: {
        fiscal_code: aValidL2User.fiscal_number,
        unlock_code: aValidPayload.unlock_code
      }
    });
    expect(res).toMatchObject({
      kind: "IResponseErrorConflict"
    });
  });

  test(`GIVEN a valid unlock_code in payload, a valid user decoded from JWT
        WHEN fast-login response is 502
        THEN the response is 502`, async () => {
    lockSessionMock.mockResolvedValueOnce(E.right({ status: 502 }));
    const handler = lockSessionHandler(fastLoginClientMock, containerClient);

    const res = await handler(aValidL2User, aValidPayload, O.some("127.0.0.1" as IPString));

    expect(lockSessionMock).toHaveBeenCalledTimes(1);
    expect(lockSessionMock).toHaveBeenCalledWith({
      body: {
        fiscal_code: aValidL2User.fiscal_number,
        unlock_code: aValidPayload.unlock_code
      }
    });
    expect(res).toMatchObject({
      kind: "IResponseErrorBadGateway",
      detail: expect.stringContaining(`Something gone wrong.`)
    });
  });

  test(`GIVEN a valid unlock_code in payload, a valid user decoded from JWT 
        WHEN fast-login response is 504
        THEN the response is 504`, async () => {
    lockSessionMock.mockResolvedValueOnce(E.right({ status: 504 }));
    const handler = lockSessionHandler(fastLoginClientMock, containerClient);

    const res = await handler(aValidL2User, aValidPayload, O.some("127.0.0.1" as IPString));

    expect(lockSessionMock).toHaveBeenCalledTimes(1);
    expect(lockSessionMock).toHaveBeenCalledWith({
      body: {
        fiscal_code: aValidL2User.fiscal_number,
        unlock_code: aValidPayload.unlock_code
      }
    });
    expect(res).toMatchObject({
      kind: "IResponseErrorGatewayTimeout",
      detail: expect.stringContaining(
        `Server couldn't respond in time, try again.`
      )
    });
  });

  test(`GIVEN a valid unlock_code in payload, a valid user decoded from JWT
        WHEN fast-login returns an error
        THEN the response is 500`, async () => {
    const errorStatus = 401;
    lockSessionMock.mockResolvedValueOnce(E.right({ status: errorStatus }));
    const handler = lockSessionHandler(fastLoginClientMock, containerClient);

    const res = await handler(aValidL2User, aValidPayload, O.some("127.0.0.1" as IPString));

    expect(lockSessionMock).toHaveBeenCalledTimes(1);
    expect(lockSessionMock).toHaveBeenCalledWith({
      body: {
        fiscal_code: aValidL2User.fiscal_number,
        unlock_code: aValidPayload.unlock_code
      }
    });
    expect(res).toMatchObject({
      kind: "IResponseErrorInternal",
      detail: expect.stringContaining(
        `Something gone wrong. Response Status: {${errorStatus}}`
      )
    });
  });

  test(`GIVEN a valid unlock_code in payload and a valid magic link user decoded from JWT
        WHEN all checks passed
        THEN the response is 204`, async () => {

    const mockAuditLog = jest
      .spyOn(auditLog, "storeAuditLog")
      .mockReturnValueOnce(TE.right({} as BlockBlobUploadResponse));

    const handler = lockSessionHandler(fastLoginClientMock, containerClient);
    const res = await handler(aValidExchangeUser, aValidPayload, O.some("127.0.0.1" as IPString));

    expect(mockAuditLog).toHaveBeenCalledTimes(1);
    expect(lockSessionMock).toHaveBeenCalledTimes(1);
    expect(lockSessionMock).toHaveBeenCalledWith({
      body: {
        fiscal_code: aValidExchangeUser.fiscal_number,
        unlock_code: aValidPayload.unlock_code
      }
    });
    expect(res).toMatchObject({
      kind: "IResponseSuccessNoContent"
    });
  });

  test(`GIVEN a user decoded from JWT with spid level L1
        WHEN checks don't pass
        THEN the response is 403`, async () => {
    const handler = lockSessionHandler(fastLoginClientMock, containerClient);

    const res = await handler(aL1User, aValidPayload, O.some("127.0.0.1" as IPString));

    expect(lockSessionMock).toHaveBeenCalledTimes(0);

    expect(res).toMatchObject({
      kind: "IResponseErrorForbiddenNotAuthorized"
    });
  });
});
// #endregion
