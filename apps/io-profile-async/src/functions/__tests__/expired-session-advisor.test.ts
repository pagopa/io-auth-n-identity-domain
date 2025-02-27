/* eslint-disable max-lines-per-function */
import { ValidationError } from "@pagopa/handler-kit";
import { MailerTransporter } from "@pagopa/io-functions-commons/dist/src/mailer";
import {
  EmailString,
  FiscalCode,
  NonEmptyString
} from "@pagopa/ts-commons/lib/strings";
import { ValidUrl } from "@pagopa/ts-commons/lib/url";
import * as E from "fp-ts/lib/Either";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Client as BackendInternalClient } from "../../generated/definitions/backend-session/client";
import { UserSessionInfo } from "../../generated/definitions/backend-session/UserSessionInfo";
import { Client as FunctionProfileClient } from "../../generated/definitions/function-profile/client";
import { ExtendedProfile } from "../../generated/definitions/function-profile/ExtendedProfile";
import { ServicesPreferencesModeEnum } from "../../generated/definitions/function-profile/ServicesPreferencesMode";
import { ExpiredSessionAdvisorQueueMessage } from "../../types/expired-session-advisor-queue-message";
import { QueueTransientError } from "../../utils/queue-utils";
import { mockQueueHandlerInputMocks } from "../__mocks__/handlerMocks";
import {
  ExpiredSessionAdvisorHandler,
  ExpiredSessionEmailParameters
} from "../expired-session-advisor";
import * as appinsights from "../../utils/appinsights";

const aFiscalCode = "BBBBBB00B00B000B" as FiscalCode;
const anExpiredAtData = new Date();
const anEmailAddres = "anemail@example.com" as EmailString;
const aValidQueueMessage = {
  fiscalCode: aFiscalCode,
  expiredAt: anExpiredAtData.getTime()
};

// Response Mocks
const aValidGetSessionResponse: UserSessionInfo = {
  active: false
};

const aValidGetProfileResponse: ExtendedProfile = {
  email: anEmailAddres,
  is_inbox_enabled: true,
  is_webhook_enabled: true,
  is_email_enabled: true,
  is_email_validated: true,
  is_email_already_taken: false,
  version: 1,
  service_preferences_settings: {
    mode: ServicesPreferencesModeEnum.AUTO
  }
};

// API Client Methods Mocks
const getSessionMock = vi.fn(async () =>
  E.of({
    status: 200,
    value: aValidGetSessionResponse
  })
);

const getProfileMock = vi.fn(async () =>
  E.of({
    status: 200,
    value: aValidGetProfileResponse
  })
);

const sendMailMock = vi.fn((_, f) => {
  f(undefined, {});
});

// Dependencies Mocks
const mockBackendInternalClient = ({
  getSession: getSessionMock
} as unknown) as BackendInternalClient;

const mockBackendFunctionProfileClient = ({
  getProfile: getProfileMock
} as unknown) as FunctionProfileClient;

const mockMailerTransporter = ({
  sendMail: sendMailMock
} as unknown) as MailerTransporter;

const trackEventMock = vi.spyOn(appinsights, "trackEvent");

const emailParameters: ExpiredSessionEmailParameters = {
  from: "amailfrom@example.com" as NonEmptyString,
  htmlToTextOptions: {
    selectors: [{ selector: "img", format: "skip" }], // Ignore all document images
    tables: true
  },
  title: "An email title" as NonEmptyString,
  ctaUrl: { href: "http://example.com" } as ValidUrl
};

const makeHandlerInputs = (input: unknown) => ({
  ...mockQueueHandlerInputMocks(
    ExpiredSessionAdvisorQueueMessage,
    input as ExpiredSessionAdvisorQueueMessage
  ),
  backendInternalClient: mockBackendInternalClient,
  functionProfileClient: mockBackendFunctionProfileClient,
  mailerTransporter: mockMailerTransporter
});

describe("ExpiredSessionAdvisor handler", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  const expiredSessionAdvisorHandlerInput = {
    dryRunFeatureFlag: false,
    expiredSessionEmailParameters: emailParameters
  };

  it("should succeed on user with no session", async () => {
    const response = await ExpiredSessionAdvisorHandler(
      expiredSessionAdvisorHandlerInput
    )({
      ...makeHandlerInputs(aValidQueueMessage)
    })();

    expect(E.isRight(response)).toBeTruthy();
    expect(getSessionMock).toHaveBeenCalledOnce();
    expect(getSessionMock).toBeCalledWith({ fiscalcode: aFiscalCode });
    expect(getProfileMock).toHaveBeenCalledOnce();
    expect(getProfileMock).toBeCalledWith({ fiscal_code: aFiscalCode });
    expect(mockMailerTransporter.sendMail).toHaveBeenCalledOnce();
  });

  it("should succeed on user with no session during a dry-run", async () => {
    const response = await ExpiredSessionAdvisorHandler({
      ...expiredSessionAdvisorHandlerInput,
      dryRunFeatureFlag: true
    })({
      ...makeHandlerInputs(aValidQueueMessage)
    })();

    expect(E.isRight(response)).toBeTruthy();
    expect(getSessionMock).toHaveBeenCalledOnce();
    expect(getSessionMock).toBeCalledWith({ fiscalcode: aFiscalCode });
    expect(getProfileMock).toHaveBeenCalledOnce();
    expect(getProfileMock).toBeCalledWith({ fiscal_code: aFiscalCode });
    expect(mockMailerTransporter.sendMail).not.toHaveBeenCalled();
    expect(trackEventMock).toHaveBeenCalledOnce();
    expect(trackEventMock).toHaveBeenCalledWith({
      name: "io.citizen-auth.prof-async.notify-session-expiration.dry-run",
      properties: {
        expiredAt: anExpiredAtData
      },
      tagOverrides: {
        samplingEnabled: "false"
      }
    });
  });

  it("should fail when a bad Message is received", async () => {
    const response = await ExpiredSessionAdvisorHandler(
      expiredSessionAdvisorHandlerInput
    )({
      ...makeHandlerInputs({ badProp: "bad" })
    })();

    expect(response).toStrictEqual(E.left(new ValidationError([])));
    expect(getSessionMock).not.toBeCalled();
    expect(getProfileMock).not.toBeCalled();
    expect(mockMailerTransporter.sendMail).not.toBeCalled();
  });

  it("should fail when a bad FiscalCode is received", async () => {
    const response = await ExpiredSessionAdvisorHandler(
      expiredSessionAdvisorHandlerInput
    )({
      ...makeHandlerInputs({
        ...aValidQueueMessage,
        fiscalCode: "bad"
      })
    })();

    expect(response).toStrictEqual(E.left(new ValidationError([])));
    expect(getSessionMock).not.toBeCalled();
    expect(getProfileMock).not.toBeCalled();
    expect(mockMailerTransporter.sendMail).not.toBeCalled();
  });

  it("should fail when a bad expiredAt is received", async () => {
    const response = await ExpiredSessionAdvisorHandler(
      expiredSessionAdvisorHandlerInput
    )({
      ...makeHandlerInputs({
        ...aValidQueueMessage,
        expiredAt: "bad"
      })
    })();

    expect(response).toStrictEqual(E.left(new ValidationError([])));
    expect(getSessionMock).not.toBeCalled();
    expect(getProfileMock).not.toBeCalled();
    expect(mockMailerTransporter.sendMail).not.toBeCalled();
  });

  // This test is to check QueuePermanentError handling
  // on QueuePermanentError the response should be a right in order to not Retry the message
  describe("QueuePermanentError", () => {
    it("should fail on user with a active session with no error forwarded", async () => {
      getSessionMock.mockImplementationOnce(async () =>
        E.of({
          status: 200,
          value: { active: true }
        })
      );

      const response = await ExpiredSessionAdvisorHandler(
        expiredSessionAdvisorHandlerInput
      )({
        ...makeHandlerInputs(aValidQueueMessage)
      })();

      expect(E.isRight(response)).toBeTruthy();
      expect(getSessionMock).toHaveBeenCalledOnce();
      expect(getSessionMock).toBeCalledWith({ fiscalcode: aFiscalCode });
      expect(getProfileMock).not.toHaveBeenCalled();
      expect(mockMailerTransporter.sendMail).not.toHaveBeenCalled();
      expect(trackEventMock).toHaveBeenCalledOnce();
      expect(trackEventMock).toHaveBeenCalledWith({
        name: "io.citizen-auth.prof-async.error.permanent",
        properties: {
          message: "User has an active session"
        },
        tagOverrides: {
          samplingEnabled: "false"
        }
      });
    });

    it("should fail on user without an email set in profile with no error forwarded", async () => {
      getProfileMock.mockImplementationOnce(async () =>
        E.of({
          status: 200,
          value: { ...aValidGetProfileResponse, email: undefined }
        })
      );

      const response = await ExpiredSessionAdvisorHandler(
        expiredSessionAdvisorHandlerInput
      )({
        ...makeHandlerInputs(aValidQueueMessage)
      })();

      expect(E.isRight(response)).toBeTruthy();
      expect(getSessionMock).toHaveBeenCalledOnce();
      expect(getSessionMock).toBeCalledWith({ fiscalcode: aFiscalCode });
      expect(getProfileMock).toHaveBeenCalledOnce();
      expect(getProfileMock).toBeCalledWith({ fiscal_code: aFiscalCode });
      expect(mockMailerTransporter.sendMail).not.toHaveBeenCalled();
      expect(trackEventMock).toHaveBeenCalledWith({
        name: "io.citizen-auth.prof-async.error.permanent",
        properties: {
          message: "User has no email"
        },
        tagOverrides: {
          samplingEnabled: "false"
        }
      });
    });
  });

  describe("QueueTransientError", () => {
    it.each`
      scenario                        | mockedImpl                                               | expectedError
      ${"throw"}                      | ${new Error("Error")}                                    | ${"Error while calling the downstream component [retrieveSession]"}
      ${"return a Left"}              | ${E.left(new ValidationError(["aaaa"]))}                 | ${"Unexpected response from backend internal [retrieveSession]"}
      ${"return status code not 200"} | ${E.right({ ...aValidGetSessionResponse, status: 500 })} | ${"Error while retrieving user session: downstream component returned 500 [retrieveSession]"}
    `(
      "should return a QueueTransientError when GetSession $scenario",
      async ({ mockedImpl, expectedError }) => {
        getSessionMock.mockImplementationOnce(async () => {
          if (mockedImpl instanceof Error) throw mockedImpl;
          return mockedImpl;
        });
        const response = await ExpiredSessionAdvisorHandler(
          expiredSessionAdvisorHandlerInput
        )({
          ...makeHandlerInputs(aValidQueueMessage)
        })();

        expect(response).toStrictEqual(
          E.left(new QueueTransientError(expectedError))
        );
        expect(getSessionMock).toHaveBeenCalledOnce();
        expect(getSessionMock).toBeCalledWith({ fiscalcode: aFiscalCode });
        expect(getProfileMock).not.toBeCalled();
        expect(mockMailerTransporter.sendMail).not.toBeCalled();
      }
    );

    it.each`
      scenario                        | mockedImpl                                               | expectedError
      ${"throw"}                      | ${new Error("Error")}                                    | ${"Error while calling the downstream component [retrieveProfile]"}
      ${"return a Left"}              | ${E.left(new ValidationError(["aaaa"]))}                 | ${"Unexpected response from function profile [retrieveProfile]"}
      ${"return status code not 200"} | ${E.right({ ...aValidGetProfileResponse, status: 500 })} | ${"Error while retrieving user profile: downstream component returned 500 [retrieveProfile]"}
    `(
      "should return a QueueTransientError when GetProfile $scenario",
      async ({ mockedImpl, expectedError }) => {
        getProfileMock.mockImplementationOnce(async () => {
          if (mockedImpl instanceof Error) throw mockedImpl;
          return mockedImpl;
        });

        const response = await ExpiredSessionAdvisorHandler(
          expiredSessionAdvisorHandlerInput
        )({
          ...makeHandlerInputs(aValidQueueMessage)
        })();

        expect(response).toStrictEqual(
          E.left(new QueueTransientError(expectedError))
        );
        expect(getSessionMock).toHaveBeenCalledOnce();
        expect(getSessionMock).toBeCalledWith({ fiscalcode: aFiscalCode });
        expect(getProfileMock).toHaveBeenCalledOnce();
        expect(getProfileMock).toBeCalledWith({ fiscal_code: aFiscalCode });
        expect(mockMailerTransporter.sendMail).not.toBeCalled();
      }
    );

    it("should return a QueueTransientError when sendMail fail", async () => {
      const anErrorMessage = "Error Sending Email";

      sendMailMock.mockImplementationOnce((_, __) => {
        throw new Error(anErrorMessage);
      });

      const response = await ExpiredSessionAdvisorHandler(
        expiredSessionAdvisorHandlerInput
      )({
        ...makeHandlerInputs(aValidQueueMessage)
      })();

      expect(response).toStrictEqual(
        E.left(
          new QueueTransientError(
            `Error while sending email to the user [notifySessionExpiration] => ${anErrorMessage}`
          )
        )
      );
      expect(getSessionMock).toHaveBeenCalledOnce();
      expect(getSessionMock).toBeCalledWith({ fiscalcode: aFiscalCode });
      expect(getProfileMock).toHaveBeenCalledOnce();
      expect(getProfileMock).toBeCalledWith({ fiscal_code: aFiscalCode });
      expect(mockMailerTransporter.sendMail).toHaveBeenCalledOnce();
    });
  });
});
