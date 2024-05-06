import crypto from "crypto";
import { describe, test, expect, vi } from "vitest";
import { Request, Response } from "express";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import {
  ResponseErrorInternal,
  ResponseSuccessJson,
} from "@pagopa/ts-commons/lib/responses";
import * as T from "fp-ts/Task";
import mockRes from "../../__mocks__/response.mocks";
import {
  mockedInitializedProfile,
  mockedUser,
} from "../../__mocks__/user.mocks";
import { mockGet, mockRedisClientSelector } from "../../__mocks__/redis.mocks";
import { anAssertionRef } from "../../__mocks__/lollipop.mocks";
import { FnAppAPIClient } from "../../repositories/api";
import mockReq from "../../__mocks__/request.mocks";
import * as profileService from "../../services/profile";
import { getSessionState } from "../session";

describe("getSessionState", () => {
  const res = mockRes() as unknown as Response;
  const req = mockReq() as unknown as Request;

  const mockGetProfile = vi.spyOn(profileService, "getProfile");
  mockGetProfile.mockReturnValue(
    T.of(ResponseSuccessJson(mockedInitializedProfile)),
  );

  const zendeskSuffixForCorrectlyRetrievedProfile = crypto
    .createHash("sha256")
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    .update(mockedInitializedProfile.email!)
    .digest("hex")
    .substring(0, 8);

  test("GIVEN a valid request WHEN lollipop is initialized for the user THEN it should return a correct session state", async () => {
    mockGet.mockResolvedValueOnce(anAssertionRef);

    await pipe(
      {
        fnAppAPIClient: {} as ReturnType<FnAppAPIClient>,
        redisClientSelector: mockRedisClientSelector,
        req,
        user: mockedUser,
      },
      getSessionState,
      TE.map((response) => response.apply(res)),
      TE.mapLeft((err) => expect(err).toBeFalsy()),
    )();

    expect(mockGet).toBeCalledWith(`KEYS-${mockedUser.fiscal_code}`);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      bpdToken: mockedUser.bpd_token,
      fimsToken: mockedUser.fims_token,
      myPortalToken: mockedUser.myportal_token,
      spidLevel: mockedUser.spid_level,
      walletToken: mockedUser.wallet_token,
      zendeskToken: `${mockedUser.zendesk_token}${zendeskSuffixForCorrectlyRetrievedProfile}`,
      lollipopAssertionRef: anAssertionRef,
    });
  });

  test("GIVEN a valid request WHEN lollipop is NOT initialized for the user THEN it should return a correct session state", async () => {
    mockGet.mockResolvedValueOnce(null);

    await pipe(
      {
        fnAppAPIClient: {} as ReturnType<FnAppAPIClient>,
        redisClientSelector: mockRedisClientSelector,
        req,
        user: mockedUser,
      },
      getSessionState,
      TE.map((response) => response.apply(res)),
      TE.mapLeft((err) => expect(err).toBeFalsy()),
    )();

    expect(mockGet).toBeCalledWith(`KEYS-${mockedUser.fiscal_code}`);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      bpdToken: mockedUser.bpd_token,
      fimsToken: mockedUser.fims_token,
      myPortalToken: mockedUser.myportal_token,
      spidLevel: mockedUser.spid_level,
      walletToken: mockedUser.wallet_token,
      zendeskToken: `${mockedUser.zendesk_token}${zendeskSuffixForCorrectlyRetrievedProfile}`,
    });
  });

  test("GIVEN a valid request WHEN an error occurs retrieving the assertion ref THEN it should return an InternalServerError", async () => {
    const expectedError = new Error("Error retrieving the assertion ref");
    mockGet.mockRejectedValueOnce(expectedError);

    await pipe(
      {
        fnAppAPIClient: {} as ReturnType<FnAppAPIClient>,
        redisClientSelector: mockRedisClientSelector,
        req,
        user: mockedUser,
      },
      getSessionState,
      TE.map((response) => response.apply(res)),
      TE.mapLeft((err) => expect(err).toBeFalsy()),
    )();

    expect(mockGet).toBeCalledWith(`KEYS-${mockedUser.fiscal_code}`);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: expect.stringContaining(expectedError.message),
        status: 500,
        title: "Internal server error",
      }),
    );
  });

  test("GIVEN a valid request WHEN an error occurs retrieving the user profile THEN it should return a correct session state", async () => {
    mockGetProfile.mockReturnValueOnce(T.of(ResponseErrorInternal("Error")));
    mockGet.mockResolvedValueOnce(null);

    await pipe(
      {
        fnAppAPIClient: {} as ReturnType<FnAppAPIClient>,
        redisClientSelector: mockRedisClientSelector,
        req,
        user: mockedUser,
      },
      getSessionState,
      TE.map((response) => response.apply(res)),
      TE.mapLeft((err) => expect(err).toBeFalsy()),
    )();

    expect(mockGet).toBeCalledWith(`KEYS-${mockedUser.fiscal_code}`);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      bpdToken: mockedUser.bpd_token,
      fimsToken: mockedUser.fims_token,
      myPortalToken: mockedUser.myportal_token,
      spidLevel: mockedUser.spid_level,
      walletToken: mockedUser.wallet_token,
      zendeskToken: expect.stringContaining(mockedUser.zendesk_token),
    });
  });
});
