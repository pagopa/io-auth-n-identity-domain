import { makeLockSessionHandler } from "../lock-session";
import { httpHandlerInputMocks } from "../__mocks__/handlerMocks";
import * as H from "@pagopa/handler-kit";
import { aFiscalCode } from "../__mocks__/general";
import * as E from "fp-ts/lib/Either";

const aValidBody = { fiscal_code: aFiscalCode, unlock_code: "123456789" };

const mockLockUserSession = jest
  .fn()
  .mockResolvedValue(E.right({ status: 204 }));
const mockBackendInternalClient = {
  authLock: mockLockUserSession
} as any;

describe("LockSession handler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return 204 with a valid payload", async () => {
    const mockReq: H.HttpRequest = {
      ...H.request("https://api.test.it/"),
      body: aValidBody
    };
    const result = await makeLockSessionHandler({
      ...httpHandlerInputMocks,
      input: mockReq,
      backendInternalClient: mockBackendInternalClient
    })();

    expect(mockLockUserSession).toHaveBeenCalled();
    expect(mockLockUserSession).toHaveBeenCalledWith({
      fiscalcode: aValidBody.fiscal_code,
      body: { unlock_code: aValidBody.unlock_code }
    });
    expect(E.isRight(result)).toEqual(true);
    expect(result).toMatchObject({ right: { statusCode: 204, body: null } });
  });

  it("should return 409 when the user is already locked", async () => {
    mockLockUserSession.mockResolvedValueOnce(E.right({ status: 409 }));
    const mockReq: H.HttpRequest = {
      ...H.request("https://api.test.it/"),
      body: aValidBody
    };
    const result = await makeLockSessionHandler({
      ...httpHandlerInputMocks,
      input: mockReq,
      backendInternalClient: mockBackendInternalClient
    })();

    expect(mockLockUserSession).toHaveBeenCalled();
    expect(E.isRight(result)).toEqual(true);
    expect(result).toMatchObject({
      right: {
        statusCode: 409,
        body: { status: 409, title: "The user lock has already been created." }
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
      mockLockUserSession.mockResolvedValueOnce(
        E.right({ status: responseCode })
      );
      const mockReq: H.HttpRequest = {
        ...H.request("https://api.test.it/"),
        body: aValidBody
      };
      const result = await makeLockSessionHandler({
        ...httpHandlerInputMocks,
        input: mockReq,
        backendInternalClient: mockBackendInternalClient
      })();

      expect(mockLockUserSession).toHaveBeenCalled();
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
    mockLockUserSession.mockRejectedValueOnce({});
    const mockReq: H.HttpRequest = {
      ...H.request("https://api.test.it/"),
      body: aValidBody
    };
    const result = await makeLockSessionHandler({
      ...httpHandlerInputMocks,
      input: mockReq,
      backendInternalClient: mockBackendInternalClient
    })();

    expect(mockLockUserSession).toHaveBeenCalled();
    expect(mockLockUserSession).toHaveBeenCalledWith({
      fiscalcode: aValidBody.fiscal_code,
      body: { unlock_code: aValidBody.unlock_code }
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
    mockLockUserSession.mockResolvedValueOnce(E.left({}));
    const mockReq: H.HttpRequest = {
      ...H.request("https://api.test.it/"),
      body: aValidBody
    };
    const result = await makeLockSessionHandler({
      ...httpHandlerInputMocks,
      input: mockReq,
      backendInternalClient: mockBackendInternalClient
    })();

    expect(mockLockUserSession).toHaveBeenCalled();
    expect(mockLockUserSession).toHaveBeenCalledWith({
      fiscalcode: aValidBody.fiscal_code,
      body: { unlock_code: aValidBody.unlock_code }
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
