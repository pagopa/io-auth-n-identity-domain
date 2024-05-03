import { describe, test, expect, vi } from "vitest";
import * as t from "io-ts";
import { ReminderStatusEnum } from "@pagopa/io-functions-app-sdk/ReminderStatus";
import { PushNotificationsContentTypeEnum } from "@pagopa/io-functions-app-sdk/PushNotificationsContentType";
import { FnAppAPIClient } from "../../repositories/api";
import { mockedExtendedProfile, mockedUser } from "../../__mocks__/user.mocks";
import { getProfile } from "../profile";
import { toInitializedProfile } from "../../types/profile";

const mockAPIGetProfile = vi.fn();
const mockedFnAppAPIClient = {
  getProfile: mockAPIGetProfile,
} as unknown as ReturnType<FnAppAPIClient>;

const validApiProfileResponse = {
  status: 200,
  value: mockedExtendedProfile,
};

describe("getProfile", () => {
  test("GIVEN a valid dependencies WHEN the API client return an valid ExtendedProfile THEN return the InitializedProfile", async () => {
    mockAPIGetProfile.mockResolvedValueOnce(t.success(validApiProfileResponse));

    const res = await getProfile({
      fnAppAPIClient: mockedFnAppAPIClient,
      user: mockedUser,
    })();

    expect(mockAPIGetProfile).toHaveBeenCalledWith({
      fiscal_code: mockedUser.fiscal_code,
    });
    expect(res).toMatchObject({
      kind: "IResponseSuccessJson",
      value: toInitializedProfile(mockedExtendedProfile, mockedUser),
    });
  });

  test.each`
    properyName                          | propertyValue
    ${"last_app_version"}                | ${"1.0.0"}
    ${"reminder_status"}                 | ${ReminderStatusEnum.DISABLED}
    ${"push_notifications_content_type"} | ${PushNotificationsContentTypeEnum.ANONYMOUS}
  `(
    "GIVEN a valid dependencies WHEN the API client return an valid ExtendedProfile with $propertyName THEN return the InitializedProfile",
    async ({ properyName, propertyValue }) => {
      mockAPIGetProfile.mockResolvedValueOnce(
        t.success({
          ...validApiProfileResponse,
          value: {
            ...validApiProfileResponse.value,
            [properyName]: propertyValue,
          },
        }),
      );

      const res = await getProfile({
        fnAppAPIClient: mockedFnAppAPIClient,
        user: mockedUser,
      })();

      expect(mockAPIGetProfile).toHaveBeenCalledWith({
        fiscal_code: mockedUser.fiscal_code,
      });
      expect(res).toMatchObject({
        kind: "IResponseSuccessJson",
        value: {
          ...toInitializedProfile(mockedExtendedProfile, mockedUser),
          [properyName]: propertyValue,
        },
      });
    },
  );

  test.each`
    status | response
    ${404} | ${"IResponseErrorNotFound"}
    ${429} | ${"IResponseErrorTooManyRequests"}
    ${500} | ${"IResponseErrorInternal"}
  `(
    "GIVEN a valid dependencies WHEN the API client return a $status response THEN return $response",
    async ({ status, response }) => {
      mockAPIGetProfile.mockResolvedValueOnce(t.success({ status }));

      const res = await getProfile({
        fnAppAPIClient: mockedFnAppAPIClient,
        user: mockedUser,
      })();

      expect(mockAPIGetProfile).toHaveBeenCalledWith({
        fiscal_code: mockedUser.fiscal_code,
      });
      expect(res.kind).toEqual(response);
    },
  );

  test("GIVEN a valid dependencies WHEN the API client throw an exception THEN return InternalServerError", async () => {
    mockAPIGetProfile.mockRejectedValueOnce(new Error("Network Error"));

    const res = await getProfile({
      fnAppAPIClient: mockedFnAppAPIClient,
      user: mockedUser,
    })();

    expect(mockAPIGetProfile).toHaveBeenCalledWith({
      fiscal_code: mockedUser.fiscal_code,
    });
    expect(res.kind).toEqual("IResponseErrorInternal");
  });
});
