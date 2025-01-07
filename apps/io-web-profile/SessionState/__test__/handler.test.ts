import * as E from "fp-ts/lib/Either";
import { aValidExchangeUser, aValidL2User } from "../../__mocks__/users";
import { Client } from "../../generated/definitions/fast-login/client";
import { sessionStateHandler } from "../handler";

// #region mocks
const aValidSessionState = {
  access_enabled: true,
  session_info: {
    active: true,
    expiration_date: "2023-09-01T12:20:38.936Z"
  }
};

const sessionStateMock = jest.fn(async () =>
  E.right({
    status: 200,
    value: aValidSessionState
  })
);
const sessionStateClientMock = ({
  getUserSessionState: sessionStateMock
} as unknown) as Client<"ApiKeyAuth">;

const emptySessionState = {
  access_enabled: false,
  session_info: { active: false, expiration_date: "" }
};
// #endregion

// #region tests
describe("SessionState", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test.each([aValidL2User, aValidExchangeUser])(
    `GIVEN a valid user decoded from JWT
        WHEN all checks passed
        THEN the response is 200`,
    async user => {
      const handler = sessionStateHandler(sessionStateClientMock);

      const res = await handler(user);

      expect(sessionStateMock).toHaveBeenCalledTimes(1);
      expect(sessionStateMock).toHaveBeenCalledWith({
        body: {
          fiscal_code: user.fiscal_number
        }
      });
      expect(res).toMatchObject({
        kind: "IResponseSuccessJson",
        value: aValidSessionState
      });
    }
  );

  test(`GIVEN a valid user decoded from JWT
    WHEN the client returns an error
      THEN the response should be 502`, async () => {
    const errorStatus = 502;
    sessionStateMock.mockResolvedValueOnce(
      E.right({
        status: errorStatus,
        value: emptySessionState
      })
    );
    const handler = sessionStateHandler(sessionStateClientMock);

    const res = await handler(aValidL2User);

    expect(sessionStateMock).toHaveBeenCalledTimes(1);
    expect(sessionStateMock).toHaveBeenCalledWith({
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
    sessionStateMock.mockResolvedValueOnce(
      E.right({
        status: errorStatus,
        value: emptySessionState
      })
    );
    const handler = sessionStateHandler(sessionStateClientMock);

    const res = await handler(aValidL2User);

    expect(sessionStateMock).toHaveBeenCalledTimes(1);
    expect(sessionStateMock).toHaveBeenCalledWith({
      body: {
        fiscal_code: aValidL2User.fiscal_number
      }
    });
    expect(res).toMatchObject({
      kind: "IResponseErrorGatewayTimeout"
    });
  });

  test(`GIVEN a valid user decoded from JWT
    WHEN the client returns an error
      THEN the response should be 500`, async () => {
    const errorStatus = 500;
    sessionStateMock.mockResolvedValueOnce(
      E.right({
        status: errorStatus,
        value: emptySessionState
      })
    );
    const handler = sessionStateHandler(sessionStateClientMock);

    const res = await handler(aValidL2User);

    expect(sessionStateMock).toHaveBeenCalledTimes(1);
    expect(sessionStateMock).toHaveBeenCalledWith({
      body: {
        fiscal_code: aValidL2User.fiscal_number
      }
    });
    expect(res).toMatchObject({
      detail: expect.stringContaining(
        "Something gone wrong. Response Status: {500}"
      ),
      kind: "IResponseErrorInternal"
    });
  });
});
// #endregion
