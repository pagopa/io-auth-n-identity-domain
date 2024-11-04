import { UnlockCode } from "../../generated/definitions/internal/UnlockCode";
import { UnlockSessionData } from "../../generated/definitions/internal/UnlockSessionData";
import { aFiscalCode } from "../__mocks__/general";
import * as E from "fp-ts/lib/Either";
import * as H from "@pagopa/handler-kit";
import { makeUnlockSessionHandler } from "../unlock-session";
import { httpHandlerInputMocks } from "../__mocks__/handlerMocks";

const aValidPayload: UnlockSessionData = {
  fiscal_code: aFiscalCode,
  unlock_code: "123456789" as UnlockCode
};
const mockReleaseAuthLock = jest
  .fn()
  .mockResolvedValue(E.right({ status: 204 }));
const mockBackendInternalClient = {
  releaseAuthLock: mockReleaseAuthLock
} as any;

describe("UnlockSession handler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return 204 given a valid payload", async () => {
    const mockReq: H.HttpRequest = {
      ...H.request("https://api.test.it/"),
      body: aValidPayload
    };
    const result = await makeUnlockSessionHandler({
      ...httpHandlerInputMocks,
      input: mockReq,
      backendInternalClient: mockBackendInternalClient
    })();

    expect(mockReleaseAuthLock).toHaveBeenCalled();
    expect(mockReleaseAuthLock).toHaveBeenCalledWith({
      fiscalcode: aValidPayload.fiscal_code,
      body: { unlock_code: aValidPayload.unlock_code }
    });
    expect(E.isRight(result)).toEqual(true);
    expect(result).toMatchObject({ right: { statusCode: 204, body: null } });
  });

  it("should return forbidden when the downstream component return the same", async () => {
    mockReleaseAuthLock.mockResolvedValueOnce(E.right({ status: 403 }));
    const mockReq: H.HttpRequest = {
      ...H.request("https://api.test.it/"),
      body: aValidPayload
    };
    const result = await makeUnlockSessionHandler({
      ...httpHandlerInputMocks,
      input: mockReq,
      backendInternalClient: mockBackendInternalClient
    })();

    expect(mockReleaseAuthLock).toHaveBeenCalled();
    expect(mockReleaseAuthLock).toHaveBeenCalledWith({
      fiscalcode: aValidPayload.fiscal_code,
      body: { unlock_code: aValidPayload.unlock_code }
    });
    expect(E.isRight(result)).toEqual(true);
    expect(result).toMatchObject({
      right: {
        statusCode: 403,
        body: {
          status: 403,
          title: "Forbidden"
        }
      }
    });
  });

  it.each`
    responseCode
    ${400}
    ${401}
    ${500}
  `(
    "should return an internal error with a $responseCode from the downstream component",
    async ({ responseCode }) => {
      mockReleaseAuthLock.mockResolvedValueOnce(
        E.right({ status: responseCode })
      );
      const mockReq: H.HttpRequest = {
        ...H.request("https://api.test.it/"),
        body: aValidPayload
      };
      const result = await makeUnlockSessionHandler({
        ...httpHandlerInputMocks,
        input: mockReq,
        backendInternalClient: mockBackendInternalClient
      })();

      expect(mockReleaseAuthLock).toHaveBeenCalled();
      expect(E.isRight(result)).toEqual(true);
      expect(result).toMatchObject({
        right: {
          statusCode: 500,
          body: {
            status: 500,
            title: `Error while deleting user session: downstream component returned ${responseCode}`
          }
        }
      });
    }
  );

  it("should return an internal error when the downstream component is unreachable via network", async () => {
    mockReleaseAuthLock.mockRejectedValueOnce({});
    const mockReq: H.HttpRequest = {
      ...H.request("https://api.test.it/"),
      body: aValidPayload
    };
    const result = await makeUnlockSessionHandler({
      ...httpHandlerInputMocks,
      input: mockReq,
      backendInternalClient: mockBackendInternalClient
    })();

    expect(mockReleaseAuthLock).toHaveBeenCalled();
    expect(mockReleaseAuthLock).toHaveBeenCalledWith({
      fiscalcode: aValidPayload.fiscal_code,
      body: { unlock_code: aValidPayload.unlock_code }
    });
    expect(E.isRight(result)).toEqual(true);
    expect(result).toMatchObject({
      right: {
        statusCode: 500,
        body: {
          status: 500,
          title: "Error while calling the downstream component"
        }
      }
    });
  });

  it("should return an internal error when the downstream component gives an unexpected response", async () => {
    mockReleaseAuthLock.mockResolvedValueOnce(E.left({}));
    const mockReq: H.HttpRequest = {
      ...H.request("https://api.test.it/"),
      body: aValidPayload
    };
    const result = await makeUnlockSessionHandler({
      ...httpHandlerInputMocks,
      input: mockReq,
      backendInternalClient: mockBackendInternalClient
    })();

    expect(mockReleaseAuthLock).toHaveBeenCalled();
    expect(mockReleaseAuthLock).toHaveBeenCalledWith({
      fiscalcode: aValidPayload.fiscal_code,
      body: { unlock_code: aValidPayload.unlock_code }
    });
    expect(E.isRight(result)).toEqual(true);
    expect(result).toMatchObject({
      right: {
        statusCode: 500,
        body: {
          status: 500,
          title: "Unexpected response from backend internal"
        }
      }
    });
  });
});
