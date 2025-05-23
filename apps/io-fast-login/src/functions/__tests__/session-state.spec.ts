import { beforeEach, describe, expect, it, vi } from "vitest";
import * as E from "fp-ts/lib/Either";
import * as H from "@pagopa/handler-kit";
import { makeSessionStateHandler } from "../session-state";
import { httpHandlerInputMocks } from "../__mocks__/handlerMocks";
import { aFiscalCode } from "../__mocks__/general";

const aValidBody = {
  fiscal_code: aFiscalCode
};
const aValidResponse = {
  access_enabled: true,
  session_info: { active: true, expiration_date: "1970-01-01", type: "LV" }
};
const mockGetUserSessionState = vi.fn().mockResolvedValue(
  E.right({
    status: 200,
    value: aValidResponse
  })
);
const sessionManagerInternalClient = {
  getUserSessionState: mockGetUserSessionState
} as any;

describe("Session state handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it("should return 200 with a valid payload", async () => {
    const mockReq: H.HttpRequest = {
      ...H.request("https://api.test.it/"),
      body: aValidBody
    };
    const result = await makeSessionStateHandler({
      ...httpHandlerInputMocks,
      input: mockReq,
      sessionManagerInternalClient
    })();

    expect(mockGetUserSessionState).toHaveBeenCalled();
    expect(mockGetUserSessionState).toHaveBeenCalledWith({
      fiscalCode: aValidBody.fiscal_code
    });
    expect(E.isRight(result)).toEqual(true);
    expect(result).toMatchObject({
      right: { statusCode: 200, body: aValidResponse }
    });
  });

  it("should return a bad request error with an invalid payload", async () => {
    const mockReq: H.HttpRequest = {
      ...H.request("https://api.test.it/"),
      body: { fiscalcode: "abc" }
    };
    const result = await makeSessionStateHandler({
      ...httpHandlerInputMocks,
      input: mockReq,
      sessionManagerInternalClient
    })();

    expect(mockGetUserSessionState).not.toHaveBeenCalled();
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
      mockGetUserSessionState.mockResolvedValueOnce(
        E.right({ status: responseCode })
      );
      const mockReq: H.HttpRequest = {
        ...H.request("https://api.test.it/"),
        body: aValidBody
      };
      const result = await makeSessionStateHandler({
        ...httpHandlerInputMocks,
        input: mockReq,
        sessionManagerInternalClient
      })();

      expect(mockGetUserSessionState).toHaveBeenCalled();
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
    mockGetUserSessionState.mockRejectedValueOnce({});
    const mockReq: H.HttpRequest = {
      ...H.request("https://api.test.it/"),
      body: aValidBody
    };
    const result = await makeSessionStateHandler({
      ...httpHandlerInputMocks,
      input: mockReq,
      sessionManagerInternalClient
    })();

    expect(mockGetUserSessionState).toHaveBeenCalled();
    expect(mockGetUserSessionState).toHaveBeenCalledWith({
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
    mockGetUserSessionState.mockResolvedValueOnce(E.left({}));
    const mockReq: H.HttpRequest = {
      ...H.request("https://api.test.it/"),
      body: aValidBody
    };
    const result = await makeSessionStateHandler({
      ...httpHandlerInputMocks,
      input: mockReq,
      sessionManagerInternalClient
    })();

    expect(mockGetUserSessionState).toHaveBeenCalled();
    expect(mockGetUserSessionState).toHaveBeenCalledWith({
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
