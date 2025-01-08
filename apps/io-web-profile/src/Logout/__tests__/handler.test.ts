import {
  BlobServiceClient,
  BlockBlobUploadResponse,
  RestError
} from "@azure/storage-blob";
import { IPString } from "@pagopa/ts-commons/lib/strings";
import * as E from "fp-ts/lib/Either";
import * as O from "fp-ts/Option";
import * as TE from "fp-ts/TaskEither";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { config as mockedConfig } from "../../__mocks__/config.mock";
import { aValidExchangeUser, aValidL2User } from "../../__mocks__/users";
import { Client } from "../../generated/definitions/fast-login/client";
import * as auditLog from "../../utils/audit-log";
import { logoutHandler } from "../handler";

// #region mocks
const logoutMock = vi.fn(async () =>
  E.right({
    status: 204
  })
);
const fastLoginClientMock = ({
  logoutFromIOApp: logoutMock
} as unknown) as Client<"ApiKeyAuth">;

const containerClient = BlobServiceClient.fromConnectionString(
  mockedConfig.AUDIT_LOG_CONNECTION_STRING
).getContainerClient(mockedConfig.AUDIT_LOG_CONTAINER);
// #endregion

// #region tests
describe("Logout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test.each([aValidL2User, aValidExchangeUser])(
    `GIVEN a valid user decoded from JWT
        WHEN audit log failed
        THEN the response is 500`,
    async user => {
      const anError = "anError";
      const mockAuditLog = vi
        .spyOn(auditLog, "storeAuditLog")
        .mockReturnValueOnce(TE.left(new RestError(anError)));
      const handler = logoutHandler(fastLoginClientMock, containerClient);

      const res = await handler(user, O.some("127.0.0.1" as IPString));

      expect(mockAuditLog).toHaveBeenCalledTimes(1);
      expect(logoutMock).toHaveBeenCalledTimes(1);
      expect(res).toMatchObject({
        detail: expect.stringContaining(anError),
        kind: "IResponseErrorInternal"
      });
    }
  );

  test.each([aValidL2User, aValidExchangeUser])(
    `GIVEN a valid user decoded from JWT
        WHEN all checks passed
        THEN the response is 204`,
    async user => {
      const mockAuditLog = vi
        .spyOn(auditLog, "storeAuditLog")
        .mockReturnValueOnce(TE.right({} as BlockBlobUploadResponse));
      const handler = logoutHandler(fastLoginClientMock, containerClient);

      const res = await handler(user, O.some("127.0.0.1" as IPString));

      expect(mockAuditLog).toHaveBeenCalledTimes(1);
      expect(logoutMock).toHaveBeenCalledTimes(1);
      expect(logoutMock).toHaveBeenCalledWith({
        body: {
          fiscal_code: user.fiscal_number
        }
      });
      expect(res).toMatchObject({
        kind: "IResponseSuccessNoContent"
      });
    }
  );

  test(`GIVEN a valid user decoded from JWT
    WHEN the client returns an error
      THEN the response should be 500`, async () => {
    const errorStatus = 500;
    logoutMock.mockResolvedValueOnce(E.right({ status: errorStatus }));
    const handler = logoutHandler(fastLoginClientMock, containerClient);

    const res = await handler(aValidL2User, O.some("127.0.0.1" as IPString));

    expect(logoutMock).toHaveBeenCalledTimes(1);
    expect(logoutMock).toHaveBeenCalledWith({
      body: {
        fiscal_code: aValidL2User.fiscal_number
      }
    });
    expect(res).toMatchObject({
      detail: expect.stringContaining(`${errorStatus}`),
      kind: "IResponseErrorInternal"
    });
  });

  test(`GIVEN a valid user decoded from JWT
    WHEN the client returns an error
      THEN the response should be 502`, async () => {
    const errorStatus = 502;
    logoutMock.mockResolvedValueOnce(E.right({ status: errorStatus }));
    const handler = logoutHandler(fastLoginClientMock, containerClient);

    const res = await handler(aValidL2User, O.some("127.0.0.1" as IPString));

    expect(logoutMock).toHaveBeenCalledTimes(1);
    expect(logoutMock).toHaveBeenCalledWith({
      body: {
        fiscal_code: aValidL2User.fiscal_number
      }
    });
    expect(res).toMatchObject({
      kind: "IResponseErrorBadGateway"
    });
  });

  test(`GIVEN a valid user decoded from JWT
    WHEN the client returns an error
      THEN the response should be 504`, async () => {
    const errorStatus = 504;
    logoutMock.mockResolvedValueOnce(E.right({ status: errorStatus }));
    const handler = logoutHandler(fastLoginClientMock, containerClient);

    const res = await handler(aValidL2User, O.some("127.0.0.1" as IPString));

    expect(logoutMock).toHaveBeenCalledTimes(1);
    expect(logoutMock).toHaveBeenCalledWith({
      body: {
        fiscal_code: aValidL2User.fiscal_number
      }
    });
    expect(res).toMatchObject({
      kind: "IResponseErrorGatewayTimeout"
    });
  });
});
// #endregion
