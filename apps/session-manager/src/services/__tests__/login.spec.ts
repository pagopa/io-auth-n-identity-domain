import { describe, test, expect } from "vitest";
import * as E from "fp-ts/Either";
import { UserLoginParams } from "@pagopa/io-functions-app-sdk/UserLoginParams";
import { IPString, NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import * as t from "io-ts";
import {
  mockStartNotifyLoginProcess,
  mockedFnAppAPIClient,
} from "../../__mocks__/repositories/fn-app-api-mocks";
import { onUserLogin } from "../login";
import {
  aFiscalCode,
  aValidFamilyname,
  aValidName,
  anEmailAddress,
} from "../../__mocks__/user.mocks";

const aUserLoginParams: UserLoginParams = {
  fiscal_code: aFiscalCode,
  name: aValidName,
  family_name: aValidFamilyname,
  email: anEmailAddress,
  identity_provider: "Poste" as NonEmptyString,
  ip_address: "127.0.0.1" as IPString,
};

describe("LoginController#onUserLogin", () => {
  enum ResponseType {
    "RESOLVE" = "RESOLVE",
    "REJECT" = "REJECT",
  }
  test.each`
    title                                                               | startNotifyLoginProcess       | type                    | expectedResult
    ${"returns true when remote service success"}                       | ${E.right({ status: 202 })}   | ${ResponseType.RESOLVE} | ${E.right(true)}
    ${"returns an error when a network error occurs"}                   | ${new Error("network error")} | ${ResponseType.REJECT}  | ${"Error calling startNotifyLoginProcess:"}
    ${"returns an error when remote service response not success"}      | ${E.right({ status: 404 })}   | ${ResponseType.RESOLVE} | ${"startNotifyLoginProcess returned"}
    ${"returns an error when the API client return a validation error"} | ${t.string.decode(1)}         | ${ResponseType.RESOLVE} | ${"Error decoding startNotifyLoginProcess response:"}
  `(
    "should $title",
    async ({ startNotifyLoginProcess, type, expectedResult }) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      type === ResponseType.RESOLVE
        ? mockStartNotifyLoginProcess.mockResolvedValueOnce(
            startNotifyLoginProcess,
          )
        : mockStartNotifyLoginProcess.mockRejectedValueOnce(
            startNotifyLoginProcess,
          );
      const result = await onUserLogin(aUserLoginParams)({
        fnAppAPIClient: mockedFnAppAPIClient,
      })();
      if (typeof expectedResult === "string" && E.isLeft(result)) {
        expect(result.left.message).contains(expectedResult);
      } else {
        expect(result).toEqual(expectedResult);
      }
    },
  );
});
