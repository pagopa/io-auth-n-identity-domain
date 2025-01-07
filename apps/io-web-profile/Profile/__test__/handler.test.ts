import * as E from "fp-ts/lib/Either";
import { aValidExchangeUser, aValidL2User } from "../../__mocks__/users";
import { Client } from "../../generated/definitions/io-functions-app/client";
import { profileHandler } from "../handler";

// #region mocks
const aValidEmailResponse = {
  email: "example@test.com"
};

const getProfileMock = jest.fn(async () =>
  E.right({
    status: 200,
    value: aValidEmailResponse
  })
);
const functionsAppClientMock = ({
  getProfile: getProfileMock
} as unknown) as Client<"SubscriptionKey">;
// #endregion

// #region tests
describe("Profile", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test.each([aValidL2User, aValidExchangeUser])(
    `GIVEN a valid user decoded from JWT
        WHEN all checks passed
        THEN the response is 200 and contains the email`,
    async user => {
      const handler = profileHandler(functionsAppClientMock);

      const res = await handler(user);

      expect(getProfileMock).toHaveBeenCalledTimes(1);
      expect(getProfileMock).toHaveBeenCalledWith({
        fiscal_code: user.fiscal_number
      });
      expect(res).toMatchObject({
        kind: "IResponseSuccessJson",
        value: aValidEmailResponse
      });
    }
  );

  test(`GIVEN a valid user decoded from JWT
        WHEN functions-app do not find the user
        THEN the response is 404`, async () => {
    const errorStatus = 404;
    getProfileMock.mockResolvedValueOnce(
      E.right({ status: errorStatus, value: { email: "" } })
    );
    const handler = profileHandler(functionsAppClientMock);

    const res = await handler(aValidL2User);

    expect(getProfileMock).toHaveBeenCalledTimes(1);
    expect(getProfileMock).toHaveBeenCalledWith({
      fiscal_code: aValidL2User.fiscal_number
    });
    expect(res).toMatchObject({
      kind: "IResponseErrorNotFound"
    });
  });

  test(`GIVEN a valid user decoded from JWT
        WHEN something goes wrong
        THEN the response is 500`, async () => {
    const errorStatus = 500;
    getProfileMock.mockResolvedValueOnce(
      E.right({ status: errorStatus, value: { email: "" } })
    );
    const handler = profileHandler(functionsAppClientMock);

    const res = await handler(aValidL2User);

    expect(getProfileMock).toHaveBeenCalledTimes(1);
    expect(getProfileMock).toHaveBeenCalledWith({
      fiscal_code: aValidL2User.fiscal_number
    });
    expect(res).toMatchObject({
      kind: "IResponseErrorInternal"
    });
  });
});
// #endregion
