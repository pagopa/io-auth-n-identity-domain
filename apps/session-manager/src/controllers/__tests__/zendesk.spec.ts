/* eslint-disable max-lines-per-function */
import { describe, it, vi, expect, beforeEach, assert } from "vitest";
import {
  ResponseErrorInternal,
  ResponseErrorNotFound,
  ResponseErrorTooManyRequests,
  ResponseSuccessJson,
} from "@pagopa/ts-commons/lib/responses";
import * as express from "express";
import * as TE from "fp-ts/TaskEither";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/lib/function";
import { Second } from "@pagopa/ts-commons/lib/units";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import mockReq from "../../__mocks__/request.mocks";
import { ZendeskController } from "../";
import {
  mockedInitializedProfile,
  mockedUser,
} from "../../__mocks__/user.mocks";
import mockRes from "../../__mocks__/response.mocks";
import { FnAppAPIClient } from "../../repositories/fn-app-api";
import { ProfileService, TokenService } from "../../services";

const mockGetProfile = vi.spyOn(ProfileService, "getProfile");

const mockGetZendeskSupportToken = vi.spyOn(
  TokenService,
  "getJwtZendeskSupportToken",
);

const aZendeskSupportToken =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJuYW1lIjoiTWFyaW8gUm9zc2kiLCJlbWFpbCI6Im1hcmlvLnJvc3NpQHRlc3QuaXQiLCJleHRlcm5hbF9pZCI6IkFBQUFBQUFBQUFBQUFBQSIsImlhdCI6MTYzNTk0NDg2MC43ODksImp0aSI6IjAxRktKWUszM04wRkpKNEVZRTM5NURIWlhDIiwiZXhwIjoxNjM1OTQ0OTIwLCJpc3MiOiJJU1NVRVIifQ.dqQlnKGME5FvpI2GbkVpk7vpgE_ft0IZE3jp2YRWHtA";

describe("ZendeskController#getZendeskSupportToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  const res = mockRes() as unknown as express.Response;
  const req = mockReq() as unknown as express.Request;

  const mockedDependencies = {
    // Repositories are not used, since we mocked the service layer
    fnAppAPIClient: {} as ReturnType<typeof FnAppAPIClient>,
    user: mockedUser,
    req,
    jwtZendeskSupportTokenSecret: "aSecret" as NonEmptyString,
    jwtZendeskSupportTokenExpiration: 1200 as Second,
    jwtZendeskSupportTokenIssuer: "issuer" as NonEmptyString,
  };

  it("should return a valid Zendesk support token when user has a validated email", async () => {
    mockGetProfile.mockReturnValueOnce(
      TE.right(ResponseSuccessJson(mockedInitializedProfile)),
    );

    mockGetZendeskSupportToken.mockReturnValue(TE.of(aZendeskSupportToken));

    const response = await pipe(
      mockedDependencies,
      ZendeskController.getZendeskSupportToken,
      TE.map((response) => response.apply(res)),
    )();

    expect(E.isRight(response)).toBeTruthy();
    expect(res.json).toHaveBeenCalledWith({
      jwt: aZendeskSupportToken,
    });
  });

  it("should return an IResponseErrorInternal if user does not have any email address", async () => {
    mockGetProfile.mockReturnValueOnce(
      TE.right(
        ResponseSuccessJson({
          ...mockedInitializedProfile,
          email: undefined,
          is_email_validated: false,
          spid_email: undefined,
        }),
      ),
    );

    await pipe(
      mockedDependencies,
      ZendeskController.getZendeskSupportToken,
      TE.map(() => assert.fail()),
      TE.mapLeft((response) =>
        expect(response).toEqual(
          Error(
            "Error retrieving a user profile with validated email address | Profile has not a validated email address",
          ),
        ),
      ),
    )();
  });

  it("should return an IResponseErrorInternal if Profile has not a validated email address", async () => {
    mockGetProfile.mockReturnValueOnce(
      TE.right(
        ResponseSuccessJson({
          ...mockedInitializedProfile,
          is_email_validated: false,
        }),
      ),
    );

    await pipe(
      mockedDependencies,
      ZendeskController.getZendeskSupportToken,
      TE.map(() => assert.fail()),
      TE.mapLeft((response) =>
        expect(response).toEqual(
          Error(
            "Error retrieving a user profile with validated email address | Profile has not a validated email address",
          ),
        ),
      ),
    )();
  });

  it("should return an IResponseErrorInternal if user has only the spid email", async () => {
    mockGetProfile.mockReturnValueOnce(
      TE.right(
        ResponseSuccessJson({
          ...mockedInitializedProfile,
          email: undefined,
          is_email_validated: false,
        }),
      ),
    );

    await pipe(
      mockedDependencies,
      ZendeskController.getZendeskSupportToken,
      TE.map(() => assert.fail()),
      TE.mapLeft((response) =>
        expect(response).toEqual(
          Error(
            "Error retrieving a user profile with validated email address | Profile has not a validated email address",
          ),
        ),
      ),
    )();
  });

  it("should return a IResponseErrorInternal if getJwtZendeskSupportToken returns an Error", async () => {
    mockGetProfile.mockReturnValueOnce(
      TE.right(ResponseSuccessJson(mockedInitializedProfile)),
    );

    mockGetZendeskSupportToken.mockReturnValueOnce(
      TE.left(new Error("ERROR while generating JWT support token")),
    );

    await pipe(
      mockedDependencies,
      ZendeskController.getZendeskSupportToken,
      TE.map(() => assert.fail()),
      TE.mapLeft((response) =>
        expect(response).toEqual(
          Error("ERROR while generating JWT support token"),
        ),
      ),
    )();
  });

  it("should return a IResponseErrorInternal if getProfile returns an error", async () => {
    mockGetProfile.mockReturnValueOnce(TE.left(Error("502 Bad Gateway")));

    await pipe(
      mockedDependencies,
      ZendeskController.getZendeskSupportToken,
      TE.map(() => assert.fail()),
      TE.mapLeft((response) =>
        expect(response).toEqual(
          Error(
            "Error retrieving a user profile with validated email address | 502 Bad Gateway",
          ),
        ),
      ),
    )();
  });

  it("should return a IResponseErrorInternal if getProfile promise gets resolved with a IResponseErrorInternal", async () => {
    mockGetProfile.mockReturnValueOnce(
      TE.right(ResponseErrorInternal("Any Error")),
    );

    await pipe(
      mockedDependencies,
      ZendeskController.getZendeskSupportToken,
      TE.map(() => assert.fail()),
      TE.mapLeft((response) =>
        expect(response).toEqual(
          Error(
            "Error retrieving a user profile with validated email address | Error retrieving user profile | Internal server error: Any Error",
          ),
        ),
      ),
    )();
  });

  it("should return a IResponseErrorInternal if getProfile promise gets resolved with a IResponseErrorTooManyRequests", async () => {
    mockGetProfile.mockReturnValueOnce(
      TE.right(ResponseErrorTooManyRequests("Rate limit triggered")),
    );

    await pipe(
      mockedDependencies,
      ZendeskController.getZendeskSupportToken,
      TE.map(() => assert.fail()),
      TE.mapLeft((response) =>
        expect(response).toEqual(
          Error(
            "Error retrieving a user profile with validated email address | Error retrieving user profile | Too many requests: Rate limit triggered",
          ),
        ),
      ),
    )();
  });

  it("should return a IResponseErrorInternal if getProfile promise gets resolved with a IResponseErrorNotFound", async () => {
    mockGetProfile.mockReturnValueOnce(
      TE.right(ResponseErrorNotFound("User not found", "Cannot find user")),
    );

    await pipe(
      mockedDependencies,
      ZendeskController.getZendeskSupportToken,
      TE.map(() => assert.fail()),
      TE.mapLeft((response) =>
        expect(response).toEqual(
          Error(
            "Error retrieving a user profile with validated email address | Error retrieving user profile | User not found: Cannot find user",
          ),
        ),
      ),
    )();
  });
});
