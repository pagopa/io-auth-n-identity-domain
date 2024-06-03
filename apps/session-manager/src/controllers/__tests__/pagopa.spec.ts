import { describe, it, expect, vi, beforeEach, assert } from "vitest";
import * as TE from "fp-ts/TaskEither";
import {
  ResponseErrorValidation,
  ResponseSuccessJson,
} from "@pagopa/ts-commons/lib/responses";
import * as express from "express";
import * as RTE from "fp-ts/ReaderTaskEither";
import { pipe } from "fp-ts/function";
import { PagoPAUser } from "../../generated/pagopa/PagoPAUser";
import mockReq from "../../__mocks__/request.mocks";
import {
  aCustomEmailAddress,
  mockedInitializedProfile,
  mockedUser,
} from "../../__mocks__/user.mocks";
import { mockRedisClientSelector } from "../../__mocks__/redis.mocks";
import { ProfileService, RedisSessionStorageService } from "../../services";
import { PagoPAController } from "..";
import { FnAppAPIClient } from "../../repositories/fn-app-api";
import { toExpectedResponse } from "../../__tests__/utils";
import { mockGetProfile as mockApiGetProfile } from "../../__mocks__/repositories/fn-app-api-mocks";
import { User } from "../../types/user";

const proxyUserResponse: PagoPAUser = {
  family_name: mockedUser.family_name,
  fiscal_code: mockedUser.fiscal_code,
  name: mockedUser.name,
  notice_email: aCustomEmailAddress,
  spid_email: mockedUser.spid_email,
};

const mockGetPagoPaNoticeEmail = vi
  .spyOn(RedisSessionStorageService, "getPagoPaNoticeEmail")
  .mockImplementation((_) => RTE.left(Error("Notify email value not found")));

const mockSetPagoPaNoticeEmail = vi
  .spyOn(RedisSessionStorageService, "setPagoPaNoticeEmail")
  .mockImplementation((_) => RTE.right(true));

const mockGetProfile = vi.spyOn(ProfileService, "getProfile");

const req = mockReq() as unknown as express.Request;
const defaultDeps = {
  fnAppAPIClient: {} as ReturnType<typeof FnAppAPIClient>,
  user: mockedUser,
  req,
  enableNoticeEmailCache: true,
  redisClientSelector: mockRedisClientSelector,
};

const defaultHappyPathExpect = TE.map((response) => {
  expect(response).toEqual(
    toExpectedResponse(ResponseSuccessJson(proxyUserResponse)),
  );
});

describe("PagoPaController#getUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return a successful response with validated email", async () => {
    mockGetProfile.mockReturnValueOnce(
      TE.of(ResponseSuccessJson(mockedInitializedProfile)),
    );
    await pipe(
      defaultDeps,
      PagoPAController.getUser,
      defaultHappyPathExpect,
      TE.mapLeft(() => assert.fail()),
    )();

    expect(mockGetPagoPaNoticeEmail).toBeCalledWith(mockedUser);
    expect(mockGetProfile).toHaveBeenCalledWith({
      ...defaultDeps,
      user: mockedUser,
    });
    expect(mockSetPagoPaNoticeEmail).toBeCalledWith(
      mockedUser,
      mockedInitializedProfile.email,
    );
  });

  it("should return a successful response with notice-email cache disabled", async () => {
    mockGetProfile.mockReturnValueOnce(
      TE.right(ResponseSuccessJson(mockedInitializedProfile)),
    );

    await pipe(
      {
        ...defaultDeps,
        enableNoticeEmailCache: false,
      },
      PagoPAController.getUser,
      defaultHappyPathExpect,
      TE.mapLeft(() => assert.fail()),
    )();

    expect(mockGetPagoPaNoticeEmail).not.toBeCalled();
    expect(mockGetProfile).toHaveBeenCalledWith({
      ...defaultDeps,
      user: mockedUser,
      enableNoticeEmailCache: false,
    });
    expect(mockSetPagoPaNoticeEmail).toBeCalledWith(
      mockedUser,
      mockedInitializedProfile.email,
    );
  });

  it("should return a successful response with cached notice email", async () => {
    mockGetPagoPaNoticeEmail.mockReturnValueOnce(
      RTE.right(aCustomEmailAddress),
    );

    await pipe(
      defaultDeps,
      PagoPAController.getUser,
      defaultHappyPathExpect,
      TE.mapLeft(() => assert.fail()),
    )();
    expect(mockApiGetProfile).not.toBeCalled();
    expect(mockGetPagoPaNoticeEmail).toBeCalledWith(mockedUser);
  });

  it("should return a validation error when user email is unverified", async () => {
    mockGetProfile.mockReturnValue(
      TE.right(
        // Return an InitializedProfile with non validated email
        ResponseSuccessJson({
          ...mockedInitializedProfile,
          is_email_validated: false,
        }),
      ),
    );

    await pipe(
      defaultDeps,
      PagoPAController.getUser,
      TE.map((response) => {
        expect(response).toEqual(
          toExpectedResponse(
            ResponseErrorValidation("Validation Error", "Invalid User Data"),
          ),
        );
      }),
      TE.mapLeft(() => assert.fail()),
    )();
    expect(mockGetProfile).toHaveBeenCalledWith({
      ...defaultDeps,
      user: mockedUser,
    });
  });

  it("should return a validation error response when user email is not verified and spid_email is not available", async () => {
    mockGetProfile.mockReturnValue(
      TE.right(
        // Return an InitializedProfile with non validated email
        ResponseSuccessJson({
          ...mockedInitializedProfile,
          is_email_validated: false,
        }),
      ),
    );

    // A session user info without spid email available
    const notSpidUserSessionUser: User = {
      ...mockedUser,
      spid_email: undefined,
    };

    await pipe(
      { ...defaultDeps, user: notSpidUserSessionUser },
      PagoPAController.getUser,
      TE.map((response) => {
        expect(response).toEqual(
          toExpectedResponse(
            ResponseErrorValidation("Validation Error", "Invalid User Data"),
          ),
        );
      }),
      TE.mapLeft(() => assert.fail()),
    )();
    expect(mockGetProfile).toHaveBeenCalledWith({
      ...defaultDeps,
      user: notSpidUserSessionUser,
    });
  });
});
