import { describe, test, expect, vi, afterEach } from "vitest";
import * as t from "io-ts";
import { ReminderStatusEnum } from "@pagopa/io-functions-app-sdk/ReminderStatus";
import { PushNotificationsContentTypeEnum } from "@pagopa/io-functions-app-sdk/PushNotificationsContentType";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import * as E from "fp-ts/Either";
import { mockedExtendedProfile, mockedUser } from "../../__mocks__/user.mocks";
import { getProfile } from "../profile";
import { toInitializedProfile } from "../../types/profile";
import {
  mockGetProfile,
  mockedFnAppAPIClient,
} from "../../__mocks__/repositories/fn-app-api-mocks";

const validApiProfileResponse = {
  status: 200,
  value: mockedExtendedProfile,
};

describe("getProfile", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });
  test("GIVEN a valid dependencies WHEN the API client return an valid ExtendedProfile THEN return the InitializedProfile", async () => {
    mockGetProfile.mockResolvedValueOnce(t.success(validApiProfileResponse));

    const result = await pipe(
      getProfile({
        fnAppAPIClient: mockedFnAppAPIClient,
        user: mockedUser,
      }),
      TE.map((res) => {
        expect(res).toMatchObject({
          kind: "IResponseSuccessJson",
          value: toInitializedProfile(mockedExtendedProfile, mockedUser),
        });
      }),
    )();

    expect(E.isRight(result)).toBeTruthy();
    expect(mockGetProfile).toHaveBeenCalledWith({
      fiscal_code: mockedUser.fiscal_code,
    });
  });

  test.each`
    propertyName                         | propertyValue
    ${"last_app_version"}                | ${"1.0.0"}
    ${"reminder_status"}                 | ${ReminderStatusEnum.DISABLED}
    ${"push_notifications_content_type"} | ${PushNotificationsContentTypeEnum.ANONYMOUS}
  `(
    "GIVEN a valid dependencies WHEN the API client return an valid ExtendedProfile with $propertyName THEN return the InitializedProfile",
    async ({ propertyName, propertyValue }) => {
      mockGetProfile.mockResolvedValueOnce(
        t.success({
          ...validApiProfileResponse,
          value: {
            ...validApiProfileResponse.value,
            [propertyName]: propertyValue,
          },
        }),
      );

      const result = await pipe(
        getProfile({
          fnAppAPIClient: mockedFnAppAPIClient,
          user: mockedUser,
        }),
        TE.map((res) => {
          expect(res).toMatchObject({
            kind: "IResponseSuccessJson",
            value: {
              ...toInitializedProfile(mockedExtendedProfile, mockedUser),
              [propertyName]: propertyValue,
            },
          });
        }),
      )();

      expect(E.isRight(result)).toBeTruthy();
      expect(mockGetProfile).toHaveBeenCalledWith({
        fiscal_code: mockedUser.fiscal_code,
      });
    },
  );

  test.each`
    serviceResponse                                | expectedResponse
    ${{ status: 404 }}                             | ${"IResponseErrorNotFound"}
    ${{ status: 429 }}                             | ${"IResponseErrorTooManyRequests"}
    ${{ status: 500, value: { detail: "error" } }} | ${"IResponseErrorInternal"}
  `(
    "GIVEN a valid dependencies WHEN the API client return a $status response THEN return $expectedResponse",
    async ({ serviceResponse, expectedResponse }) => {
      mockGetProfile.mockResolvedValueOnce(t.success(serviceResponse));

      const result = await pipe(
        getProfile({
          fnAppAPIClient: mockedFnAppAPIClient,
          user: mockedUser,
        }),
        TE.map((res) => {
          expect(res.kind).toEqual(expectedResponse);
        }),
      )();

      expect(E.isRight(result)).toBeTruthy();
      expect(mockGetProfile).toHaveBeenCalledWith({
        fiscal_code: mockedUser.fiscal_code,
      });
    },
  );

  test("GIVEN a valid dependencies WHEN the API client throw an exception THEN return InternalServerError", async () => {
    const expectedError = new Error("Network Error");
    mockGetProfile.mockRejectedValueOnce(expectedError);

    const result = await pipe(
      getProfile({
        fnAppAPIClient: mockedFnAppAPIClient,
        user: mockedUser,
      }),
      TE.mapLeft((err) => expect(err.message).contain(expectedError.message)),
    )();

    expect(E.isRight(result)).toBeFalsy();
    expect(mockGetProfile).toHaveBeenCalledWith({
      fiscal_code: mockedUser.fiscal_code,
    });
  });
});
