import { describe, test, expect, vi, beforeEach } from "vitest";

import * as express from "express";

import * as E from "fp-ts/Either";
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
import { LollipopApiClient } from "../../repositories/lollipop-api";

import { GenerateLCParamsErrors } from "../../services/lollipop";
import * as profileService from "../../services/profile";
import { getUserForFIMS, getLollipopUserForFIMS } from "../sso";

import { RedisClientSelectorType } from "../../types/redis";
import {
  toGenericError,
  toNotFoundError,
  unauthorizedError,
} from "../../models/domain-errors";

import { FIMSUser } from "../../generated/fims/FIMSUser";
import { FIMSPlusUser } from "../../generated/fims/FIMSPlusUser";
import { LcParams } from "../../generated/lollipop-api/LcParams";

import {
  mockedInitializedProfile,
  mockedUser,
} from "../../__mocks__/user.mocks";
import mockRes from "../../__mocks__/response.mocks";
import mockReq from "../../__mocks__/request.mocks";
import { aValidLCParamsResult } from "../../__mocks__/lollipop.mocks";
import {
  mockGenerateLCParams,
  mockedLollipopService,
} from "../../__mocks__/services/lollipopService.mocks";
import { mockedRedisSessionStorageService } from "../../__mocks__/services/redisSessionStorageService.mocks";

const mockGetProfile = vi.spyOn(profileService, "getProfile");
mockGetProfile.mockReturnValue(
  TE.of(ResponseSuccessJson(mockedInitializedProfile)),
);

beforeEach(() => {
  vi.clearAllMocks();
});

const missingProfileMessage = "Missing profile";
const internalServerErrorMessage = "Internal server error";

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
    const result = await pipe(
      mockedDependencies,
      getUserForFIMS,
      TE.map((response) => response.apply(res)),
    )();

    expect(E.isLeft(result)).toBeFalsy();

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expectedFIMSUserResponse);
  });

  test("when the profile does not contain a validated email, then it returns a FIMS user without the email", async () => {
    mockGetProfile.mockReturnValueOnce(
      TE.of(
        ResponseSuccessJson({
          ...mockedInitializedProfile,
          is_email_validated: false,
        }),
      ),
    );

    const result = await pipe(
      mockedDependencies,
      getUserForFIMS,
      TE.map((response) => response.apply(res)),
    )();

    expect(E.isLeft(result)).toBeFalsy();

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      ...expectedFIMSUserResponse,
      email: undefined,
    });
  });

  test.each`
    scenario | getProfileResponse                                           | expectedStatusCode | expectedTitle                 | expectedDetail
    ${"404"} | ${ResponseErrorNotFound("Not Found", missingProfileMessage)} | ${404}             | ${"Not Found"}                | ${missingProfileMessage}
    ${"429"} | ${ResponseErrorTooManyRequests()}                            | ${429}             | ${"Too many requests"}        | ${""}
    ${"500"} | ${ResponseErrorInternal("an Error")}                         | ${500}             | ${internalServerErrorMessage} | ${"an Error"}
  `(
    "when the profile service returns $scenario, then it returns $expectedStatusCode",
    async ({
      getProfileResponse,
      expectedStatusCode,
      expectedTitle,
      expectedDetail,
    }) => {
      mockGetProfile.mockReturnValueOnce(TE.of(getProfileResponse));

      const result = await pipe(
        mockedDependencies,
        getUserForFIMS,
        TE.map((response) => response.apply(res)),
      )();

      expect(E.isLeft(result)).toBeFalsy();

      expect(res.status).toHaveBeenCalledWith(expectedStatusCode);
      expect(res.json).toHaveBeenCalledWith({
        title: expectedTitle,
        detail: expectedDetail,
        status: expectedStatusCode,
      });
    },
  );
});

describe("SSOController#getLollipopUserForFIMS", () => {
  const res = mockRes() as unknown as express.Response;
  const req = mockReq({
    body: { operation_id: "anId" },
  }) as unknown as express.Request;

  const expectedFIMSPlusUserResponse: FIMSPlusUser = {
    profile: {
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
    },
    lc_params: {
      assertion_ref: aValidLCParamsResult.assertion_ref,
      pub_key: aValidLCParamsResult.pub_key,
      lc_authentication_bearer: aValidLCParamsResult.lc_authentication_bearer,
    },
  };

  const mockedDependencies = {
    // Repositories are not used, since we mocked the service layer
    fnAppAPIClient: {} as ReturnType<typeof FnAppAPIClient>,
    redisClientSelector: {} as RedisClientSelectorType,
    lollipopApiClient: {} as LollipopApiClient,
    lollipopService: mockedLollipopService,
    redisSessionStorageService: mockedRedisSessionStorageService,
    user: mockedUser,
    req,
  };

  test("when the profile contains a validated email, then it returns a FIMS+ user with email", async () => {
    await pipe(
      mockedDependencies,
      getLollipopUserForFIMS,
      TE.map((response) => response.apply(res)),
      TE.mapLeft((err) => expect(err).toBeFalsy()),
    )();

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expectedFIMSPlusUserResponse);
  });

  test("when the profile does not contain a validated email, then it returns a FIMS+ user without the email", async () => {
    mockGetProfile.mockReturnValueOnce(
      TE.of(
        ResponseSuccessJson({
          ...mockedInitializedProfile,
          is_email_validated: false,
        }),
      ),
    );

    await pipe(
      mockedDependencies,
      getLollipopUserForFIMS,
      TE.map((response) => response.apply(res)),
      TE.mapLeft((err) => expect(err).toBeFalsy()),
    )();

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      ...expectedFIMSPlusUserResponse,
      profile: { ...expectedFIMSPlusUserResponse.profile, email: undefined },
    });
  });

  test("when input is wrong, then it returns a 400", async () => {
    await pipe(
      { ...mockedDependencies, req: mockReq() as unknown as express.Request },
      getLollipopUserForFIMS,
      TE.map((response) => response.apply(res)),
      TE.mapLeft((err) => expect(err).toBeFalsy()),
    )();

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      title: "Bad request",
      detail: expect.stringContaining("is not a valid"),
      status: 400,
    });
  });

  test.each`
    scenario | getProfileResponse                                           | expectedStatusCode | expectedTitle                 | expectedDetail
    ${"404"} | ${ResponseErrorNotFound("Not Found", missingProfileMessage)} | ${404}             | ${"Not Found"}                | ${missingProfileMessage}
    ${"429"} | ${ResponseErrorTooManyRequests()}                            | ${429}             | ${"Too many requests"}        | ${""}
    ${"500"} | ${ResponseErrorInternal("an Error")}                         | ${500}             | ${internalServerErrorMessage} | ${"an Error"}
  `(
    "when the profile service returns $scenario, then it returns $expectedStatusCode",
    async ({
      getProfileResponse,
      expectedStatusCode,
      expectedTitle,
      expectedDetail,
    }) => {
      mockGetProfile.mockReturnValueOnce(TE.of(getProfileResponse));

      await pipe(
        mockedDependencies,
        getLollipopUserForFIMS,
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

  test.each`
    lollipopServiceResponse              | expectedStatusCode | expectedTitle                 | expectedDetail
    ${toNotFoundError("LollipopPubKey")} | ${404}             | ${"Not Found"}                | ${"Unable to find entity of type LollipopPubKey"}
    ${unauthorizedError}                 | ${403}             | ${"You are not allowed here"} | ${"You do not have enough permission to complete the operation you requested"}
    ${toGenericError("an error")}        | ${500}             | ${internalServerErrorMessage} | ${"an error"}
    ${toGenericError()}                  | ${500}             | ${internalServerErrorMessage} | ${"Generic error while generating LC Params for FIMS+ User"}
    ${Error("another error")}            | ${500}             | ${internalServerErrorMessage} | ${"another error"}
  `(
    "when the lollipop service returns $scenario, then it returns $expectedStatusCode",
    async ({
      lollipopServiceResponse,
      expectedStatusCode,
      expectedTitle,
      expectedDetail,
    }) => {
      mockGenerateLCParams.mockReturnValueOnce((_deps) =>
        TE.left<GenerateLCParamsErrors, LcParams>(
          lollipopServiceResponse as GenerateLCParamsErrors,
        ),
      );

      await pipe(
        mockedDependencies,
        getLollipopUserForFIMS,
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
