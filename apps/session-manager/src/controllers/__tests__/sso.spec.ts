import { describe, test, expect, vi, beforeEach } from "vitest";

import * as express from "express";

import * as E from "fp-ts/Either";
import * as T from "fp-ts/Task";
import * as TE from "fp-ts/TaskEither";
import { pipe } from "fp-ts/lib/function";

import {
  ResponseErrorInternal,
  ResponseErrorNotFound,
  ResponseErrorTooManyRequests,
  ResponseSuccessJson,
} from "@pagopa/ts-commons/lib/responses";
import { DateFromString } from "@pagopa/ts-commons/lib/dates";

import { FnAppAPIClient } from "../../repositories/fn-app-api";

import * as profileService from "../../services/profile";
import { getUserForFIMS } from "../sso";

import { RedisClientSelectorType } from "../../types/redis";

import {
  mockedInitializedProfile,
  mockedUser,
} from "../../__mocks__/user.mocks";
import mockRes from "../../__mocks__/response.mocks";
import mockReq from "../../__mocks__/request.mocks";
import { FIMSUser } from "../../generated/fims/FIMSUser";

const mockGetProfile = vi.spyOn(profileService, "getProfile");
mockGetProfile.mockReturnValue(
  T.of(ResponseSuccessJson(mockedInitializedProfile)),
);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SSOController#getUserForFIMS", () => {
  const res = mockRes() as unknown as express.Response;
  const req = mockReq() as unknown as express.Request;

  const expectedFIMSUserResponse: FIMSUser = {
    acr: mockedUser.spid_level,
    auth_time: mockedUser.created_at,
    date_of_birth: pipe(
      mockedUser.date_of_birth,
      DateFromString.decode,
      E.getOrElseW(() => {
        throw Error("Invalid test initialization");
      }),
    ),
    email: mockedInitializedProfile.email,
    family_name: mockedUser.family_name,
    fiscal_code: mockedUser.fiscal_code,
    name: mockedUser.name,
  };

  const mockedDependencies = {
    // Repositories are not used, since we mocked the service layer
    fnAppAPIClient: {} as ReturnType<typeof FnAppAPIClient>,
    redisClientSelector: {} as RedisClientSelectorType,
    user: mockedUser,
    req,
  };

  test("when the profile contains a validated email, then it returns a FIMS user with email", async () => {
    await pipe(
      mockedDependencies,
      getUserForFIMS,
      TE.map((response) => response.apply(res)),
      TE.mapLeft((err) => expect(err).toBeFalsy()),
    )();

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expectedFIMSUserResponse);
  });

  test("when the profile does not contain a validated email, then it returns a FIMS user without the email", async () => {
    mockGetProfile.mockReturnValueOnce(
      T.of(
        ResponseSuccessJson({
          ...mockedInitializedProfile,
          is_email_validated: false,
        }),
      ),
    );

    await pipe(
      mockedDependencies,
      getUserForFIMS,
      TE.map((response) => response.apply(res)),
      TE.mapLeft((err) => expect(err).toBeFalsy()),
    )();

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      ...expectedFIMSUserResponse,
      email: undefined,
    });
  });

  test.each`
    scenario | getProfileResponse                                       | expectedStatusCode | expectedTitle              | expectedDetail
    ${"404"} | ${ResponseErrorNotFound("Not Found", "Missing profile")} | ${404}             | ${"Not Found"}             | ${"Missing profile"}
    ${"429"} | ${ResponseErrorTooManyRequests()}                        | ${429}             | ${"Too many requests"}     | ${""}
    ${"500"} | ${ResponseErrorInternal("an Error")}                     | ${500}             | ${"Internal server error"} | ${"an Error"}
  `(
    "when the profile service returns $scenario, then it returns $expectedStatusCode",
    async ({
      getProfileResponse,
      expectedStatusCode,
      expectedTitle,
      expectedDetail,
    }) => {
      mockGetProfile.mockReturnValueOnce(T.of(getProfileResponse));

      await pipe(
        mockedDependencies,
        getUserForFIMS,
        TE.map((response) => response.apply(res)),
        TE.mapLeft((err) => expect(err).toBeFalsy()),
      )();

      expect(res.status).toHaveBeenCalledWith(expectedStatusCode);
      expect(res.json).toHaveBeenCalledWith({
        title: expectedTitle,
        detail: expectedDetail,
        status: expectedStatusCode,
      });
    },
  );
});
