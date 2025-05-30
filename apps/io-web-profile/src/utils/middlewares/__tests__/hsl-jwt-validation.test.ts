import * as E from "fp-ts/Either";
import * as TE from "fp-ts/TaskEither";

import {
  ResponseSuccessJson,
  getResponseErrorForbiddenNotAuthorized
} from "@pagopa/ts-commons/lib/responses";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { config, hslConfig } from "../../../__mocks__/config.mock";
import { hslJwtValidation } from "../hsl-jwt-validation-middleware";

import * as introspectionCall from "../../introspection-call";

describe(`Hub Spid Login JWT Validation Middleware`, () => {
  const token = hslConfig.HUB_SPID_LOGIN_MOCK_TOKEN as NonEmptyString;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it(`Should validate JWT and call hub-spid-login for introspection call,
    - Should return JWT payload
    - Success -`, async () => {
    const mockIntrospectionCall = vi
      .spyOn(introspectionCall, "introspectionCall")
      .mockReturnValueOnce(TE.right(ResponseSuccessJson({ active: true })));

    const jwtValidation = hslJwtValidation(config);
    const result = await jwtValidation(token)();

    console.log("SCOPPIA", result);
    console.log(token);

    expect(E.isRight(result)).toBe(true);
    expect(mockIntrospectionCall).toHaveBeenCalledTimes(1);
    expect(mockIntrospectionCall).toHaveBeenCalledWith(token, config);

    const resultPayload = E.fold(
      () => null,
      payload => payload
    )(result);

    expect(resultPayload).toMatchObject({
      name: "Carla",
      family_name: "Rossi",
      fiscal_number: "ISPXNB32R82Y766D"
    });
  });

  it(`Should call hub-spid-login for introspection call,
    - Introspection should fail
    - Failed -`, async () => {
    const mockIntrospectionCall = vi
      .spyOn(introspectionCall, "introspectionCall")
      .mockReturnValueOnce(TE.left(getResponseErrorForbiddenNotAuthorized()));

    const jwtValidation = hslJwtValidation(config);
    const result = await jwtValidation(token)();

    expect(E.isLeft(result)).toBe(true);
    expect(mockIntrospectionCall).toHaveBeenCalledTimes(1);
    expect(mockIntrospectionCall).toHaveBeenCalledWith(token, config);

    if (E.isLeft(result)) {
      const error = result.left;
      expect(error.kind).toBe("IResponseErrorForbiddenNotAuthorized");
    }
  });
});

describe(`Hub Spid Login JWT Validation Middleware`, () => {
  it(`Should fail if JWT is not valid or expired,
     - Fail -`, async () => {
    const token = "" as NonEmptyString;
    const jwtValidation = hslJwtValidation(config);
    const result = await jwtValidation(token)();

    expect(E.isLeft(result)).toBe(true);
  });
});
