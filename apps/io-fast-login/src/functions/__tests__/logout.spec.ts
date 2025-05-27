import { beforeEach, describe, expect, it, vi } from "vitest";
import * as E from "fp-ts/lib/Either";
import * as H from "@pagopa/handler-kit";
import { makeLogoutHandler } from "../logout";
import { httpHandlerInputMocks } from "../__mocks__/handlerMocks";
import { aFiscalCode } from "../__mocks__/general";

const mockDeleteUserSession = vi
  .fn()
  .mockResolvedValue(E.right({ status: 200 }));
const sessionManagerInternalClient = {
  deleteUserSession: mockDeleteUserSession
} as any;

const aValidBody = {
  fiscal_code: aFiscalCode
};

describe("Logout handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it("should return 204 with a valid payload", async () => {
    const mockReq: H.HttpRequest = {
      ...H.request("https://api.test.it/"),
      body: aValidBody
    };
    const result = await makeLogoutHandler({
      ...httpHandlerInputMocks,
      input: mockReq,
      sessionManagerInternalClient
    })();

    expect(mockDeleteUserSession).toHaveBeenCalled();
    expect(mockDeleteUserSession).toHaveBeenCalledWith({
      fiscalCode: aValidBody.fiscal_code
    });
    expect(E.isRight(result)).toEqual(true);
    expect(result).toMatchObject({ right: { statusCode: 204 } });
  });

  it("should return a bad request error with an invalid payload", async () => {
    const mockReq: H.HttpRequest = {
      ...H.request("https://api.test.it/"),
      body: { fiscalcode: "abc" }
    };
    const result = await makeLogoutHandler({
      ...httpHandlerInputMocks,
      input: mockReq,
      sessionManagerInternalClient
    })();

    expect(mockDeleteUserSession).not.toHaveBeenCalled();
    expect(E.isRight(result)).toEqual(true);
    expect(result).toMatchObject({
      right: {
        statusCode: 400,
        body: { status: 400, title: "Missing or invalid body" }
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
      mockDeleteUserSession.mockResolvedValueOnce(
        E.right({ status: responseCode })
      );
      const mockReq: H.HttpRequest = {
        ...H.request("https://api.test.it/"),
        body: aValidBody
      };
      const result = await makeLogoutHandler({
        ...httpHandlerInputMocks,
        input: mockReq,
        sessionManagerInternalClient
      })();

      expect(mockDeleteUserSession).toHaveBeenCalled();
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
    mockDeleteUserSession.mockRejectedValueOnce({});
    const mockReq: H.HttpRequest = {
      ...H.request("https://api.test.it/"),
      body: aValidBody
    };
    const result = await makeLogoutHandler({
      ...httpHandlerInputMocks,
      input: mockReq,
      sessionManagerInternalClient
    })();

    expect(mockDeleteUserSession).toHaveBeenCalled();
    expect(mockDeleteUserSession).toHaveBeenCalledWith({
      fiscalCode: aValidBody.fiscal_code
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
    mockDeleteUserSession.mockResolvedValueOnce(E.left({}));
    const mockReq: H.HttpRequest = {
      ...H.request("https://api.test.it/"),
      body: aValidBody
    };
    const result = await makeLogoutHandler({
      ...httpHandlerInputMocks,
      input: mockReq,
      sessionManagerInternalClient
    })();

    expect(mockDeleteUserSession).toHaveBeenCalled();
    expect(mockDeleteUserSession).toHaveBeenCalledWith({
      fiscalCode: aValidBody.fiscal_code
    });
    expect(E.isRight(result)).toEqual(true);
    expect(result).toMatchObject({
      right: {
        statusCode: 500,
        body: {
          status: 500,
          title: "Unexpected response from session manager internal"
        }
      }
    });
  });
});
