import { describe, test, expect, vi, afterEach } from "vitest";
import * as t from "io-ts";

import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import * as E from "fp-ts/Either";
import {
  Issuer,
  SPID_IDP_IDENTIFIERS,
} from "@pagopa/io-spid-commons/dist/config";

import {
  ResponseErrorConflict,
  ResponseErrorInternal,
  ResponseErrorTooManyRequests,
  ResponseSuccessJson,
} from "@pagopa/ts-commons/lib/responses";

import { NewProfile } from "../../generated/io-profile/NewProfile";
import { ReminderStatusEnum } from "../../generated/io-profile/ReminderStatus";
import { PushNotificationsContentTypeEnum } from "../../generated/io-profile/PushNotificationsContentType";

import {
  aFiscalCode,
  aSpidEmailAddress,
  aValidDateofBirth,
  aValidFamilyname,
  aValidName,
  aValidSpidLevel,
  mockedExtendedProfile,
  mockedUser,
} from "../../__mocks__/user.mocks";
import { createProfile, getProfile } from "../profile";
import { toInitializedProfile } from "../../types/profile";
import {
  mockCreateProfile,
  mockGetProfile,
  mockedFnAppAPIClient,
} from "../../__mocks__/repositories/fn-app-api-mocks";
import { aLollipopAssertion } from "../../__mocks__/lollipop.mocks";
import { toExpectedResponse } from "../../__tests__/utils";

const validApiProfileResponse = {
  status: 200,
  value: mockedExtendedProfile,
};

describe("ProfileService#getProfile", () => {
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

describe("ProfileService#createProfile", () => {
  // validUser has all every field correctly set.
  const validUserPayload = {
    authnContextClassRef: aValidSpidLevel,
    email: aSpidEmailAddress,
    familyName: aValidFamilyname,
    fiscalNumber: aFiscalCode,
    issuer: Object.keys(SPID_IDP_IDENTIFIERS)[0] as Issuer,
    dateOfBirth: aValidDateofBirth,
    name: aValidName,
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    getAcsOriginalRequest: () => {},
    getAssertionXml: () => aLollipopAssertion,
    getSamlResponseXml: () => aLollipopAssertion,
  };

  const createProfileRequest: NewProfile = {
    email: aSpidEmailAddress,
    is_email_validated: false,
    is_test_profile: false,
  };
  test("create an user profile to the API", async () => {
    mockCreateProfile.mockResolvedValueOnce(t.success(validApiProfileResponse));

    const result = await pipe(
      createProfile(
        mockedUser,
        validUserPayload,
      )({
        fnAppAPIClient: mockedFnAppAPIClient,
        testLoginFiscalCodes: [],
      }),
    )();

    expect(mockCreateProfile).toHaveBeenCalledWith({
      fiscal_code: mockedUser.fiscal_code,
      body: createProfileRequest,
    });
    expect(result).toEqual(
      E.right(toExpectedResponse(ResponseSuccessJson(createProfileRequest))),
    );
  });

  test("fails to create an user profile to the API", async () => {
    mockCreateProfile.mockResolvedValueOnce(
      t.success({
        status: 500,
        value: {
          detail: "a detail error",
        },
      }),
    );

    const result = await pipe(
      createProfile(
        mockedUser,
        validUserPayload,
      )({
        fnAppAPIClient: mockedFnAppAPIClient,
        testLoginFiscalCodes: [],
      }),
    )();

    expect(result).toEqual(
      E.right(
        toExpectedResponse(
          ResponseErrorInternal("unhandled API response status [500]"),
        ),
      ),
    );
  });

  test("returns an 429 HTTP error from createProfile upstream API", async () => {
    mockCreateProfile.mockResolvedValueOnce(
      t.success({
        status: 429,
      }),
    );

    const result = await pipe(
      createProfile(
        mockedUser,
        validUserPayload,
      )({
        fnAppAPIClient: mockedFnAppAPIClient,
        testLoginFiscalCodes: [],
      }),
    )();

    expect(result).toEqual(
      E.right(toExpectedResponse(ResponseErrorTooManyRequests())),
    );
  });

  test("returns an 409 HTTP error from createProfile upstream API", async () => {
    mockCreateProfile.mockResolvedValueOnce(
      t.success({
        status: 409,
      }),
    );

    const result = await pipe(
      createProfile(
        mockedUser,
        validUserPayload,
      )({
        fnAppAPIClient: mockedFnAppAPIClient,
        testLoginFiscalCodes: [],
      }),
    )();

    expect(result).toEqual(
      E.right(
        toExpectedResponse(
          ResponseErrorConflict(
            "A user with the provided fiscal code already exists",
          ),
        ),
      ),
    );
  });
});
