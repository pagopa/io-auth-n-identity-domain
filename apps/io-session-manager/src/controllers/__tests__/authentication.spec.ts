/* eslint-disable max-lines-per-function */
import { EventTypeEnum } from "@pagopa/io-auth-n-identity-commons/types/session-events/event-type";
import {
  LoginEvent,
  LoginScenarioEnum,
  LoginTypeEnum as ServiceBusLoginTypeEnum,
} from "@pagopa/io-auth-n-identity-commons/types/session-events/login-event";
import { RejectedLoginCauseEnum } from "@pagopa/io-auth-n-identity-commons/types/session-events/rejected-login-event";
import { sha256 } from "@pagopa/io-functions-commons/dist/src/utils/crypto";
import {
  CIE_IDP_IDENTIFIERS,
  IDP_NAMES,
  Issuer,
  SPID_IDP_IDENTIFIERS,
} from "@pagopa/io-spid-commons/dist/config";
import {
  ResponseErrorInternal,
  ResponseErrorNotFound,
  ResponseErrorValidation,
  ResponseSuccessJson,
} from "@pagopa/ts-commons/lib/responses";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import { withoutUndefinedValues } from "@pagopa/ts-commons/lib/types";
import { ValidUrl } from "@pagopa/ts-commons/lib/url";
import { addDays, addMonths, addSeconds, format, subYears } from "date-fns";
import { Response } from "express";
import * as E from "fp-ts/Either";
import * as O from "fp-ts/Option";
import * as TE from "fp-ts/TaskEither";
import { afterAll, beforeEach, describe, expect, test, vi } from "vitest";
import {
  mockTrackEvent,
  mockedAppinsightsTelemetryClient,
} from "../../__mocks__/appinsights.mocks";
import {
  aLollipopAssertion,
  aSpidL3LollipopAssertion,
  anAssertionRef,
  anotherAssertionRef,
  lollipopData,
} from "../../__mocks__/lollipop.mocks";
import { mockRedisClientSelector } from "../../__mocks__/redis.mocks";
import { mockedFnAppAPIClient } from "../../__mocks__/repositories/fn-app-api-mocks";
import { mockedLollipopApiClient } from "../../__mocks__/repositories/lollipop-api.mocks";
import { mockQueueClient } from "../../__mocks__/repositories/queue-client.mocks";
import { mockedTableClient } from "../../__mocks__/repositories/table-client-mocks";
import mockReq from "../../__mocks__/request.mocks";
import mockRes, { resetMock } from "../../__mocks__/response.mocks";
import { mockServiceBusSender } from "../../__mocks__/service-bus-sender.mocks";
import {
  aFiscalCode,
  aSessionTrackingId,
  aSpidEmailAddress,
  aValidDateofBirth,
  aValidFamilyname,
  aValidName,
  aValidSpidLevel,
  mockBPDToken,
  mockFIMSToken,
  mockMyPortalToken,
  mockSessionToken,
  mockWalletToken,
  mockZendeskToken,
  mockedInitializedProfile,
  mockedUser,
} from "../../__mocks__/user.mocks";
import { toExpectedResponse } from "../../__tests__/utils";
import {
  lvLongSessionDurationSecs,
  lvTokenDurationSecs,
} from "../../config/fast-login";
import { standardTokenDurationSecs } from "../../config/login";
import {
  getClientErrorRedirectionUrl,
  getClientProfileRedirectionUrl,
} from "../../config/spid";
import {
  VALIDATION_COOKIE_NAME,
  VALIDATION_COOKIE_SETTINGS,
} from "../../config/validation-cookie";
import { AssertionTypeEnum } from "../../generated/fast-login-api/AssertionType";
import { ActivatedPubKey } from "../../generated/lollipop-api/ActivatedPubKey";
import { AssertionRef } from "../../generated/lollipop-api/AssertionRef";
import { JwkPubKey } from "../../generated/lollipop-api/JwkPubKey";
import { PubKeyStatusEnum } from "../../generated/lollipop-api/PubKeyStatus";
import { LollipopRevokeRepo } from "../../repositories";
import {
  mockAuthSessionsTopicRepository,
  mockEmitSessionEvent,
} from "../../repositories/__mocks__/auth-session-topic-repository.mocks";
import {
  AuthenticationLockService,
  LoginService,
  LollipopService,
  ProfileService,
  RedisSessionStorageService,
  TokenService,
} from "../../services";
import { LoginTypeEnum } from "../../types/fast-login";
import { SpidLevelEnum } from "../../types/spid-level";
import { SpidUser } from "../../types/user";
import { withCookieClearanceResponsePermanentRedirect } from "../../utils/responses";
import * as AuthController from "../authentication";
import {
  AGE_LIMIT,
  AGE_LIMIT_ERROR_CODE,
  AUTHENTICATION_LOCKED_ERROR,
  AcsDependencies,
  DIFFERENT_USER_ACTIVE_SESSION_LOGIN_ERROR_CODE,
  acs,
  acsTest,
} from "../authentication";

const dependencies: AcsDependencies = {
  redisClientSelector: mockRedisClientSelector,
  fnAppAPIClient: mockedFnAppAPIClient,
  lockUserTableClient: mockedTableClient,
  fnLollipopAPIClient: mockedLollipopApiClient,
  lollipopRevokeQueueClient: mockQueueClient,
  testLoginFiscalCodes: [],
  notificationQueueClient: mockQueueClient,
  getClientErrorRedirectionUrl,
  getClientProfileRedirectionUrl,
  allowedCieTestFiscalCodes: [],
  standardTokenDurationSecs,
  lvTokenDurationSecs,
  lvLongSessionDurationSecs,
  isUserElegibleForIoLoginUrlScheme: () => false,
  appInsightsTelemetryClient: mockedAppinsightsTelemetryClient,
  isUserElegibleForFastLogin: () => false,
  isUserElegibleForValidationCookie: () => false,
  AuthSessionsTopicRepository: mockAuthSessionsTopicRepository,
  authSessionsTopicSender: mockServiceBusSender,
};

const aRequestIpAddress = "127.0.0.2";
const req = mockReq();
// eslint-disable-next-line functional/immutable-data
req.ip = aRequestIpAddress;
const aValidEntityID = Object.keys(SPID_IDP_IDENTIFIERS)[0] as Issuer;

// validUser has all every field correctly set.
const validUserPayload = {
  authnContextClassRef: aValidSpidLevel,
  email: aSpidEmailAddress,
  familyName: aValidFamilyname,
  fiscalNumber: aFiscalCode,
  issuer: aValidEntityID,
  dateOfBirth: aValidDateofBirth,
  name: aValidName,
  getAcsOriginalRequest: () => req,
  getAssertionXml: () => aLollipopAssertion,
  getSamlResponseXml: () => aLollipopAssertion,
};

const invalidUserPayload = {
  authnContextClassRef: aValidSpidLevel,
  fiscalNumber: aFiscalCode,
  getAcsOriginalRequest: () => undefined,
  getAssertionXml: () => "",
  getSamlResponseXml: () => "",
  issuer: aValidEntityID,
  dateOfBirth: aValidDateofBirth,
  name: aValidName,
};

const mockGetNewTokenAsync = vi.spyOn(TokenService, "getNewTokenAsync");

const setupGetNewTokensMocks = () => {
  mockGetNewTokenAsync
    .mockResolvedValueOnce(mockSessionToken)
    .mockResolvedValueOnce(mockWalletToken)
    .mockResolvedValueOnce(mockMyPortalToken)
    .mockResolvedValueOnce(mockBPDToken)
    .mockResolvedValueOnce(mockZendeskToken)
    .mockResolvedValueOnce(mockFIMSToken)
    .mockResolvedValueOnce(aSessionTrackingId);
};

const mockIsBlockedUser = vi
  .spyOn(RedisSessionStorageService, "isBlockedUser")
  .mockImplementation(() => TE.right(false));
vi.spyOn(RedisSessionStorageService, "delLollipopDataForUser").mockReturnValue(
  TE.of(true),
);
const mockSet = vi
  .spyOn(RedisSessionStorageService, "set")
  .mockReturnValue(() => TE.of(true));
const mockGetProfile = vi
  .spyOn(ProfileService, "getProfile")
  .mockReturnValue(
    TE.of(ResponseErrorNotFound("Not Found.", "Profile not found")),
  );
const mockCreateProfile = vi
  .spyOn(ProfileService, "createProfile")
  .mockReturnValue(() =>
    TE.of(
      ResponseSuccessJson({
        ...mockedInitializedProfile,
        is_email_validated: false,
      }),
    ),
  );
const mockOnUserLogin = vi
  .spyOn(LoginService, "onUserLogin")
  .mockReturnValue(() => TE.of(true));

const anErrorResponse = {
  detail: undefined,
  status: 500,
  title: "Internal server error",
  type: undefined,
};

const badRequestErrorResponse = {
  detail: expect.any(String),
  status: 400,
  title: expect.any(String),
  type: undefined,
};

const expectedIdPName = IDP_NAMES[aValidEntityID];
const expectedUserLoginData = {
  email: mockedInitializedProfile.email,
  family_name: mockedInitializedProfile.family_name,
  fiscal_code: mockedInitializedProfile.fiscal_code,
  identity_provider: expectedIdPName,
  // TODO change
  ip_address: aRequestIpAddress,
  name: mockedInitializedProfile.name,
  is_email_validated: mockedInitializedProfile.is_email_validated,
};

const res = mockRes() as unknown as Response;

const getProfileUrlWithToken = (token: string) =>
  `/profile.html?token=${token}#token=${token}`;

beforeEach(() => {
  vi.clearAllMocks();
  resetMock(res as unknown as ReturnType<typeof mockRes>);
  setupGetNewTokensMocks();
});

describe("AuthenticationController#acs", () => {
  const frozenDate = new Date("2025-10-01T00:00:00Z");

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ now: frozenDate });
  });

  afterAll(() => {
    vi.useRealTimers();
  });
  test("redirects to the correct url if userPayload is a valid User and a profile not exists", async () => {
    /* const expectedNewProfile: NewProfile = {
      email: validUserPayload.email,
      is_email_validated: false,
      is_test_profile: false,
    }; */ // This should be tested in ProfileService

    const response = await acs(dependencies)(validUserPayload);
    response.apply(res);

    expect(res.redirect).toBeCalledWith(
      301,
      expect.stringContaining(getProfileUrlWithToken(mockSessionToken)),
    );
    expect(res.clearCookie).toHaveBeenCalledTimes(1);
    expect(mockSet).toHaveBeenCalledWith(
      mockRedisClientSelector,
      standardTokenDurationSecs,
    );
    expect(mockGetProfile).toHaveBeenCalledWith({
      fnAppAPIClient: mockedFnAppAPIClient,
      user: expect.objectContaining({
        ...mockedUser,
        created_at: expect.any(Number), // TODO: mock date
      }),
    });
    expect(mockCreateProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        ...mockedUser,
        created_at: expect.any(Number), // TODO: mock date
      }),
      validUserPayload,
    );
    expect(mockOnUserLogin).toHaveBeenCalled();
  });

  test("redirects to the correct url if userPayload is a valid User and a profile exists", async () => {
    mockGetProfile.mockReturnValueOnce(
      TE.of(ResponseSuccessJson(mockedInitializedProfile)),
    );

    const response = await acs(dependencies)(validUserPayload);
    response.apply(res);

    expect(res.redirect).toHaveBeenCalledWith(
      301,
      expect.stringContaining(getProfileUrlWithToken(mockSessionToken)),
    );
    expect(res.clearCookie).toHaveBeenCalledTimes(1);
    expect(mockSet).toHaveBeenCalledWith(
      mockRedisClientSelector,
      standardTokenDurationSecs,
    );
    expect(mockGetProfile).toHaveBeenCalledWith({
      fnAppAPIClient: mockedFnAppAPIClient,
      user: expect.objectContaining({
        ...mockedUser,
        created_at: expect.any(Number), // TODO: mock date
      }),
    });
    expect(mockCreateProfile).not.toBeCalled();

    expect(mockOnUserLogin).toHaveBeenCalled();
  });

  test("should fail if a profile cannot be created", async () => {
    mockCreateProfile.mockReturnValueOnce(() =>
      TE.of(ResponseErrorInternal("Error creating new user profile")),
    );
    const response = await acs(dependencies)(validUserPayload);
    response.apply(res);

    expect(res.clearCookie).toHaveBeenCalledTimes(1);
    expect(mockSet).toHaveBeenCalledWith(
      mockRedisClientSelector,
      standardTokenDurationSecs,
    );
    expect(mockGetProfile).toHaveBeenCalledWith({
      fnAppAPIClient: mockedFnAppAPIClient,
      user: expect.objectContaining({
        ...mockedUser,
        created_at: expect.any(Number), // TODO: mock date
      }),
    });
    expect(mockCreateProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        ...mockedUser,
        created_at: expect.any(Number), // TODO: mock date
      }),
      validUserPayload,
    );
    expect(mockOnUserLogin).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      ...anErrorResponse,
      detail: "Error creating a new User Profile",
    });
  });

  test("should fail if an error occours checking the profile", async () => {
    mockGetProfile.mockReturnValueOnce(
      TE.of(ResponseErrorInternal("Error reading the user profile")),
    );
    const response = await acs(dependencies)(validUserPayload);
    response.apply(res);

    expect(res.clearCookie).toHaveBeenCalledTimes(1);
    expect(mockSet).toHaveBeenCalledWith(
      mockRedisClientSelector,
      standardTokenDurationSecs,
    );
    expect(mockGetProfile).toHaveBeenCalledWith({
      fnAppAPIClient: mockedFnAppAPIClient,
      user: expect.objectContaining({
        ...mockedUser,
        created_at: expect.any(Number), // TODO: mock date
      }),
    });
    expect(mockCreateProfile).not.toHaveBeenCalled();
    expect(mockOnUserLogin).not.toHaveBeenCalled();

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      ...anErrorResponse,
      detail: "IResponseErrorInternal",
    });
  });

  test("should fail if userPayload is invalid", async () => {
    const response = await acs(dependencies)(invalidUserPayload);
    response.apply(res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.clearCookie).toHaveBeenCalledTimes(1);

    expect(res.json).toHaveBeenCalledWith(badRequestErrorResponse);
    expect(mockSet).not.toHaveBeenCalled();
  });

  test("should fail if request ip is invalid", async () => {
    const invalidIPreq = mockReq();

    invalidIPreq.ip = "anInvalidIpAddress";
    const invalidIpUserPayload = {
      ...validUserPayload,
      getAcsOriginalRequest: () => invalidIPreq,
    };

    const response = await acs(dependencies)(invalidIpUserPayload);
    response.apply(res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.clearCookie).toHaveBeenCalledTimes(1);

    expect(res.json).toHaveBeenCalledWith({
      ...anErrorResponse,
      detail: "Error reading user IP",
    });
    expect(mockSet).not.toHaveBeenCalled();
  });

  test("should fail if request lack of ip", async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { ip, ...ipLackingRequest } = req;
    const invalidIpUserPayload = {
      ...validUserPayload,
      getAcsOriginalRequest: () => ipLackingRequest,
    };

    const response = await acs(dependencies)(invalidIpUserPayload);
    response.apply(res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.clearCookie).toHaveBeenCalledTimes(1);

    expect(res.json).toHaveBeenCalledWith({
      ...anErrorResponse,
      detail: "Error reading user IP",
    });
    expect(mockSet).not.toHaveBeenCalled();
  });

  test("should fail if the session can not be saved", async () => {
    mockSet.mockReturnValueOnce(() => TE.of(false));

    const response = await acs(dependencies)(validUserPayload);
    response.apply(res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.clearCookie).toHaveBeenCalledTimes(1);
    expect(res.json).toHaveBeenCalledWith({
      ...anErrorResponse,
      detail: "Error creating the user session",
    });
  });

  test("should return Unathorized if user is blocked", async () => {
    mockIsBlockedUser.mockReturnValueOnce(TE.right(true));

    const response = await acs(dependencies)(validUserPayload);
    response.apply(res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.clearCookie).toHaveBeenCalledTimes(1);

    expect(mockEmitSessionEvent).toHaveBeenCalledExactlyOnceWith({
      eventType: EventTypeEnum.REJECTED_LOGIN,
      rejectionCause: RejectedLoginCauseEnum.ONGOING_USER_DELETION,
      fiscalCode: validUserPayload.fiscalNumber,
      ip: aRequestIpAddress,
      ts: frozenDate,
      loginId: anotherAssertionRef,
    });
  });

  test("should write a customEvent when rejection_login event emission fails", async () => {
    mockIsBlockedUser.mockReturnValueOnce(TE.right(true));

    const anErrorMessage = "Error emitting rejection login event";

    mockEmitSessionEvent.mockImplementationOnce(
      () => () => TE.left(new Error(anErrorMessage)),
    );

    const expectedRejectionEvent = {
      eventType: EventTypeEnum.REJECTED_LOGIN,
      rejectionCause: RejectedLoginCauseEnum.ONGOING_USER_DELETION,
      fiscalCode: validUserPayload.fiscalNumber,
      ip: aRequestIpAddress,
      ts: frozenDate,
      loginId: anotherAssertionRef,
    };

    const response = await acs(dependencies)(validUserPayload);
    response.apply(res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.clearCookie).toHaveBeenCalledTimes(1);

    expect(mockEmitSessionEvent).toHaveBeenCalledExactlyOnceWith(
      expectedRejectionEvent,
    );

    expect(mockedAppinsightsTelemetryClient.trackEvent).toBeCalledWith(
      expect.objectContaining({
        name: "acs.error.rejected_login_event.emit_failed",
        properties: {
          message: anErrorMessage,
          stack: expect.any(String),
          ...expectedRejectionEvent,
        },
        tagOverrides: {
          samplingEnabled: "false",
        },
      }),
    );
  });

  test("should fail if Redis Client returns an error while getting info on user blocked", async () => {
    mockIsBlockedUser.mockReturnValueOnce(TE.left(new Error("Redis error")));

    const response = await acs(dependencies)(validUserPayload);
    response.apply(res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.clearCookie).toHaveBeenCalledTimes(1);
    expect(res.json).toHaveBeenCalledWith({
      ...anErrorResponse,
      detail: "Error while validating user",
    });
  });

  test("should fail if Redis client returns an error", async () => {
    mockSet.mockReturnValueOnce(() => TE.left(new Error("Redis Error")));

    const response = await acs(dependencies)(validUserPayload);
    response.apply(res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.clearCookie).toHaveBeenCalledTimes(1);
    expect(res.json).toHaveBeenCalledWith({
      ...anErrorResponse,
      detail: "Error while creating the user session",
    });
  });
});

describe("AuthenticationController#acs Active Session Test", () => {
  const frozenDate = new Date("2025-10-01T00:00:00Z");

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ now: frozenDate });
  });

  afterAll(() => {
    vi.useRealTimers();
  });
  test("should redirects to the correct url when the fiscalCode on userPayload match the one received from the APP(stored in additionalProps)", async () => {
    const additionalProps = {
      currentUser: sha256(validUserPayload.fiscalNumber),
    };

    mockGetProfile.mockReturnValueOnce(
      TE.of(ResponseSuccessJson(mockedInitializedProfile)),
    );

    const response = await acs(dependencies)(validUserPayload, additionalProps);
    response.apply(res);

    expect(res.redirect).toHaveBeenCalledWith(
      301,
      expect.stringContaining(getProfileUrlWithToken(mockSessionToken)),
    );
    expect(res.clearCookie).toHaveBeenCalledTimes(1);
    expect(mockSet).toHaveBeenCalledWith(
      mockRedisClientSelector,
      standardTokenDurationSecs,
    );
    expect(mockGetProfile).toHaveBeenCalledWith({
      fnAppAPIClient: mockedFnAppAPIClient,
      user: expect.objectContaining({
        ...mockedUser,
        created_at: expect.any(Number), // TODO: mock date
      }),
    });
    expect(mockCreateProfile).not.toBeCalled();

    expect(mockOnUserLogin).toHaveBeenCalled();
  });

  test("should redirects to the error url if the fiscalCode on userPayload mismatch the one received from the APP(stored in additionalProps)", async () => {
    const aDifferentUserFiscalCodeHash =
      "192f21644cee286251c289a4a4dbf5489bab4d463ba5cf07f140a0d16220276e"; // sha256 of a dummy fiscal code AAAAAA00B11C222D
    const additionalProps = {
      currentUser: aDifferentUserFiscalCodeHash,
    };

    const response = await acs(dependencies)(validUserPayload, additionalProps);
    response.apply(res);

    expect(mockedAppinsightsTelemetryClient.trackEvent).toBeCalledWith(
      expect.objectContaining({
        name: "acs.error.different_user_active_session_login",
        properties: {
          message: expect.any(String),
          currentUser: aDifferentUserFiscalCodeHash,
          spidFiscalNumberSha256: sha256(validUserPayload.fiscalNumber),
        },
        tagOverrides: {
          samplingEnabled: "false",
        },
      }),
    );
    expect(mockSet).not.toBeCalled();
    expect(res.redirect).toHaveBeenCalledWith(
      301,
      expect.stringContaining(
        `/error.html?errorCode=${DIFFERENT_USER_ACTIVE_SESSION_LOGIN_ERROR_CODE}`,
      ),
    );

    expect(mockEmitSessionEvent).toHaveBeenCalledExactlyOnceWith({
      eventType: EventTypeEnum.REJECTED_LOGIN,
      rejectionCause: RejectedLoginCauseEnum.CF_MISMATCH,
      fiscalCode: validUserPayload.fiscalNumber,
      ip: aRequestIpAddress,
      ts: frozenDate,
      currentFiscalCodeHash: aDifferentUserFiscalCodeHash,
      loginId: anotherAssertionRef,
    });

    expect(res.clearCookie).toHaveBeenCalledTimes(1);
  });

  test("should return a 400 error response when a bad currentUser is provided in additionalProps)", async () => {
    const additionalProps = {
      currentUser: "bad_current_user",
    };

    const response = await acs(dependencies)(validUserPayload, additionalProps);
    response.apply(res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.clearCookie).toHaveBeenCalledTimes(1);

    expect(res.json).toHaveBeenCalledWith(badRequestErrorResponse);
    expect(mockSet).not.toHaveBeenCalled();
  });
});

describe("AuthenticationController#acs Age Limit", () => {
  const frozenDate = new Date("2025-10-01T00:00:00Z");

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ now: frozenDate });
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  test(`should return unauthorized if the user is younger than ${AGE_LIMIT} yo`, async () => {
    const aYoungDateOfBirth = format(
      addDays(subYears(new Date(), AGE_LIMIT), 1),
      "YYYY-MM-DD",
    );
    const aYoungUserPayload: SpidUser = {
      ...validUserPayload,
      dateOfBirth: aYoungDateOfBirth,
    };
    const response = await acs(dependencies)(aYoungUserPayload);
    response.apply(res);

    expect(mockedAppinsightsTelemetryClient.trackEvent).toBeCalledWith(
      expect.objectContaining({
        name: "spid.error.generic",
        properties: {
          message: expect.any(String),
          type: "INFO",
        },
      }),
    );
    expect(mockSet).not.toBeCalled();
    expect(res.redirect).toHaveBeenCalledWith(
      301,
      expect.stringContaining(`/error.html?errorCode=${AGE_LIMIT_ERROR_CODE}`),
    );

    expect(mockEmitSessionEvent).toHaveBeenCalledExactlyOnceWith({
      eventType: EventTypeEnum.REJECTED_LOGIN,
      rejectionCause: RejectedLoginCauseEnum.AGE_BLOCK,
      fiscalCode: aYoungUserPayload.fiscalNumber,
      ip: aRequestIpAddress,
      ts: frozenDate,
      minimumAge: AGE_LIMIT,
      dateOfBirth: aYoungDateOfBirth,
      loginId: anotherAssertionRef,
    });

    expect(res.clearCookie).toHaveBeenCalledTimes(1);
  });

  test(`should return unauthorized if the user is younger than ${AGE_LIMIT} yo with CIE date format`, async () => {
    const limitDate = subYears(new Date(), AGE_LIMIT);
    const dateOfBirth =
      limitDate.getDate() > 8 ? addDays(limitDate, 1) : addMonths(limitDate, 1);

    const aYoungUserPayload: SpidUser = {
      ...validUserPayload,
      dateOfBirth: format(dateOfBirth, "YYYY-MM-D"),
    };
    const response = await acs(dependencies)(aYoungUserPayload);
    response.apply(res);

    expect(mockedAppinsightsTelemetryClient.trackEvent).toBeCalledWith(
      expect.objectContaining({
        name: "spid.error.generic",
        properties: {
          message: expect.any(String),
          type: "INFO",
        },
      }),
    );
    expect(mockSet).not.toBeCalled();
    expect(res.redirect).toHaveBeenCalledWith(
      301,
      expect.stringContaining(`/error.html?errorCode=${AGE_LIMIT_ERROR_CODE}`),
    );
    expect(res.clearCookie).toHaveBeenCalledTimes(1);
  });

  test(`should redirects to the correct url if the user has ${AGE_LIMIT} yo`, async () => {
    const aYoungUserPayload: SpidUser = {
      ...validUserPayload,
      dateOfBirth: format(subYears(new Date(), AGE_LIMIT), "YYYY-MM-DD"),
    };
    const response = await acs(dependencies)(aYoungUserPayload);
    response.apply(res);

    expect(res.redirect).toHaveBeenCalledWith(
      301,
      expect.stringContaining(getProfileUrlWithToken(mockSessionToken)),
    );
    expect(res.clearCookie).toHaveBeenCalledTimes(1);
    expect(mockSet).toHaveBeenCalledWith(
      mockRedisClientSelector,
      standardTokenDurationSecs,
    );
    expect(mockGetProfile).toHaveBeenCalledWith({
      fnAppAPIClient: mockedFnAppAPIClient,
      user: expect.objectContaining({
        ...mockedUser,
        created_at: expect.any(Number), // TODO: mock date
        date_of_birth: aYoungUserPayload.dateOfBirth,
      }),
    });
    expect(mockCreateProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        ...mockedUser,
        date_of_birth: aYoungUserPayload.dateOfBirth,
        created_at: expect.any(Number), // TODO: mock date
      }),
      aYoungUserPayload,
    );
  });
});

const mockGetLollipopAssertionRefForUser = vi
  .spyOn(RedisSessionStorageService, "getLollipopAssertionRefForUser")
  .mockReturnValue(TE.of(O.some(anAssertionRef)));

const mockDelLollipopDataForUser = vi
  .spyOn(RedisSessionStorageService, "delLollipopDataForUser")
  .mockReturnValue(TE.of(true));

const mockSetLollipopAssertionRefForUser = vi
  .spyOn(RedisSessionStorageService, "setLollipopAssertionRefForUser")
  .mockReturnValue(() => TE.of(true));

const mockRevokePreviousAssertionRef = vi
  .spyOn(LollipopRevokeRepo, "revokePreviousAssertionRef")
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  .mockReturnValue(() => TE.of({} as any));

const mockSetLollipopDataForUser = vi
  .spyOn(RedisSessionStorageService, "setLollipopDataForUser")
  .mockReturnValue(() => TE.of(true));

const anActivatedPubKey = {
  status: PubKeyStatusEnum.VALID,
  assertion_file_name: "file",
  assertion_ref: "sha" as AssertionRef,
  assertion_type: AssertionTypeEnum.SAML,
  fiscal_code: aFiscalCode,
  pub_key: {} as JwkPubKey,
  ttl: 600,
  version: 1,
  expires_at: 1000,
} as unknown as ActivatedPubKey;

const mockActivateLolliPoPKey = vi
  .spyOn(LollipopService, "activateLolliPoPKey")
  .mockImplementation(({ assertionRef }) =>
    TE.of({
      ...anActivatedPubKey,
      assertion_ref: assertionRef,
    }),
  );

const mockDeleteAssertionRefAssociation = vi
  .spyOn(LollipopService, "deleteAssertionRefAssociation")
  .mockReturnValue(() => TE.of(true));

// eslint-disable-next-line max-lines-per-function
describe("AuthenticationController#acs Lollipop", () => {
  const acsErrorEventName = "lollipop.error.acs";
  test(`redirects to the correct url using the lollipop features`, async () => {
    mockGetProfile.mockReturnValueOnce(
      TE.of(ResponseSuccessJson(mockedInitializedProfile)),
    );

    const response = await acs({ ...dependencies })(validUserPayload);
    response.apply(res);
    await new Promise((resolve) => setTimeout(() => resolve(""), 10));

    expect(res.redirect).toHaveBeenCalledWith(
      301,
      expect.stringContaining(getProfileUrlWithToken(mockSessionToken)),
    );
    expect(res.clearCookie).toHaveBeenCalledTimes(1);

    expect(mockGetLollipopAssertionRefForUser).toHaveBeenCalledTimes(1);
    expect(mockGetLollipopAssertionRefForUser).toBeCalledWith(
      expect.objectContaining({ fiscalCode: aFiscalCode }),
    );
    expect(mockRevokePreviousAssertionRef).toHaveBeenCalledWith(anAssertionRef);
    expect(mockDelLollipopDataForUser).toBeCalledWith(
      expect.objectContaining({
        fiscalCode: aFiscalCode,
      }),
    );
    expect(mockActivateLolliPoPKey).toBeCalledWith(
      expect.objectContaining({
        assertionRef: anotherAssertionRef, // Check the assertionRef returned from getSAMLResponseXML
        fiscalCode: aFiscalCode,
        assertion: expect.any(String),
        getExpirePubKeyFn: expect.any(Function),
        appInsightsTelemetryClient: mockedAppinsightsTelemetryClient,
      }),
    );
    expect(mockSetLollipopAssertionRefForUser).toBeCalledWith(
      expect.objectContaining({
        fiscal_code: aFiscalCode,
      }),
      anotherAssertionRef,
      standardTokenDurationSecs,
    );

    expect(mockSet).toHaveBeenCalledWith(
      mockRedisClientSelector,
      standardTokenDurationSecs,
    );
    expect(mockGetProfile).toHaveBeenCalledWith({
      fnAppAPIClient: mockedFnAppAPIClient,
      user: expect.objectContaining({
        ...mockedUser,
        created_at: expect.any(Number), // TODO: mock date
      }),
    });
    expect(mockCreateProfile).not.toBeCalled();
  });

  test(`should return an error if getProfile fail and the key was successfully activated`, async () => {
    mockGetProfile.mockReturnValueOnce(
      TE.of(ResponseErrorInternal("Error reading the user profile")),
    );

    const response = await acs({ ...dependencies })(validUserPayload);
    response.apply(res);
    await new Promise((resolve) => setTimeout(() => resolve(""), 10));

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.clearCookie).toHaveBeenCalledTimes(1);

    expect(mockGetProfile).toHaveBeenCalledWith({
      fnAppAPIClient: mockedFnAppAPIClient,
      user: expect.objectContaining({
        ...mockedUser,
        created_at: expect.any(Number), // TODO: mock date
      }),
    });
    expect(mockSetLollipopAssertionRefForUser).toBeCalledWith(
      expect.objectContaining({
        fiscal_code: aFiscalCode,
      }),
      anotherAssertionRef,
      standardTokenDurationSecs,
    );
    expect(mockDeleteAssertionRefAssociation).toBeCalledWith(
      aFiscalCode,
      anotherAssertionRef,
      expect.any(String),
      expect.any(String),
    );
  });

  test.each`
    scenario                 | setLollipopAssertionRefForUserResponse | errorMessage
    ${"with false response"} | ${TE.right(false)}                     | ${"Error creating CF - assertion ref relation in redis"}
    ${"with left response"}  | ${TE.left(new Error("Error"))}         | ${"Error"}
  `(
    "should fail if an error occours saving assertionRef for user in redis $scenario",
    async ({ setLollipopAssertionRefForUserResponse, errorMessage }) => {
      mockSetLollipopAssertionRefForUser.mockReturnValueOnce(
        () => setLollipopAssertionRefForUserResponse,
      );

      const response = await acs({ ...dependencies })(validUserPayload, req);
      response.apply(res);

      expect(mockedAppinsightsTelemetryClient.trackEvent).toHaveBeenCalledWith({
        name: acsErrorEventName,
        properties: expect.objectContaining({
          assertion_ref: anotherAssertionRef,
          fiscal_code: sha256(aFiscalCode),
          message: errorMessage,
        }),
      });

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.clearCookie).toHaveBeenCalledTimes(1);
      expect(response).toEqual({
        apply: expect.any(Function),
        detail: "Internal server error: Error Activation Lollipop Key",
        kind: "IResponseErrorInternal",
      });

      expect(mockSetLollipopAssertionRefForUser).toBeCalledWith(
        expect.objectContaining({
          fiscal_code: aFiscalCode,
        }),
        anotherAssertionRef,
        standardTokenDurationSecs,
      );

      expect(mockSet).not.toBeCalled();
      expect(mockGetProfile).not.toBeCalled();
      expect(mockCreateProfile).not.toBeCalled();
      expect(mockOnUserLogin).not.toHaveBeenCalled();
    },
  );

  test(`should fail if an error occours activating a pubkey for lollipop`, async () => {
    mockActivateLolliPoPKey.mockImplementationOnce(() =>
      TE.left(new Error("Error")),
    );

    const response = await acs({ ...dependencies })(validUserPayload, req);
    response.apply(res);
    await new Promise((resolve) => setTimeout(() => resolve(""), 100));

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.clearCookie).toHaveBeenCalledTimes(1);
    expect(response).toEqual({
      apply: expect.any(Function),
      detail: "Internal server error: Error Activation Lollipop Key",
      kind: "IResponseErrorInternal",
    });

    expect(mockActivateLolliPoPKey).toBeCalledWith(
      expect.objectContaining({
        assertionRef: anotherAssertionRef, // Check the assertionRef returned from getSAMLResponseXML
        fiscalCode: aFiscalCode,
        assertion: expect.any(String),
        getExpirePubKeyFn: expect.any(Function),
        appInsightsTelemetryClient: mockedAppinsightsTelemetryClient,
      }),
    );

    expect(mockSetLollipopAssertionRefForUser).not.toBeCalled();
    expect(mockSet).not.toBeCalled();
    expect(mockGetProfile).not.toBeCalled();
    expect(mockCreateProfile).not.toBeCalled();
    expect(mockOnUserLogin).not.toHaveBeenCalled();
  });

  test.each`
    scenario                 | delLollipopDataForUserResponse         | errorMessage
    ${"with false response"} | ${TE.right(false)}                     | ${"Error on LolliPoP initialization"}
    ${"with left response"}  | ${TE.left(new Error("Error on left"))} | ${"Error on left"}
  `(
    "should fail if an error occours deleting the previous CF-assertionRef link on redis $scenario",
    async ({ delLollipopDataForUserResponse, errorMessage }) => {
      mockDelLollipopDataForUser.mockReturnValueOnce(
        delLollipopDataForUserResponse,
      );

      const response = await acs({ ...dependencies })(validUserPayload, req);
      response.apply(res);

      expect(mockedAppinsightsTelemetryClient.trackEvent).toHaveBeenCalledWith({
        name: acsErrorEventName,
        properties: expect.objectContaining({
          fiscal_code: sha256(aFiscalCode),
          message: `acs: ${errorMessage}`,
        }),
      });

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.clearCookie).toHaveBeenCalledTimes(1);
      expect(response).toEqual({
        apply: expect.any(Function),
        detail: `Internal server error: ${errorMessage}`,
        kind: "IResponseErrorInternal",
      });

      expect(mockDelLollipopDataForUser).toBeCalledWith(
        expect.objectContaining({
          fiscalCode: aFiscalCode,
        }),
      );

      expect(mockActivateLolliPoPKey).not.toBeCalled();
      expect(mockSetLollipopAssertionRefForUser).not.toBeCalled();
      expect(mockSet).not.toBeCalled();
      expect(mockGetProfile).not.toBeCalled();
      expect(mockCreateProfile).not.toBeCalled();
      expect(mockOnUserLogin).not.toHaveBeenCalled();
    },
  );

  test(`should fail if an error occours reading the previous CF-assertionRef link on redis`, async () => {
    mockGetLollipopAssertionRefForUser.mockReturnValueOnce(
      TE.left(new Error("Error")),
    );

    const response = await acs({ ...dependencies })(validUserPayload, req);
    response.apply(res);

    expect(mockedAppinsightsTelemetryClient.trackEvent).toHaveBeenCalledWith({
      name: acsErrorEventName,
      properties: expect.objectContaining({
        fiscal_code: sha256(aFiscalCode),
        message: "Error retrieving previous lollipop configuration",
      }),
    });

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.clearCookie).toHaveBeenCalledTimes(1);
    expect(response).toEqual({
      apply: expect.any(Function),
      detail:
        "Internal server error: Error retrieving previous lollipop configuration",
      kind: "IResponseErrorInternal",
    });

    expect(mockGetLollipopAssertionRefForUser).toHaveBeenCalledTimes(1);
    expect(mockGetLollipopAssertionRefForUser).toBeCalledWith(
      expect.objectContaining({ fiscalCode: aFiscalCode }),
    );
    expect(mockRevokePreviousAssertionRef).not.toBeCalled();
    expect(mockDelLollipopDataForUser).not.toBeCalled();
    expect(mockActivateLolliPoPKey).not.toBeCalled();
    expect(mockSetLollipopAssertionRefForUser).not.toBeCalled();

    expect(mockSet).not.toBeCalled();
    expect(mockGetProfile).not.toBeCalled();
    expect(mockCreateProfile).not.toBeCalled();
    expect(mockOnUserLogin).not.toHaveBeenCalled();
  });
});

describe("AuthenticationController#acs urischeme", () => {
  test.each`
    isUserElegible | expectedUriScheme
    ${false}       | ${"https:"}
    ${true}        | ${"iologin:"}
  `(
    "should succeed and redirect to the correct URI scheme($expectedUriScheme) when IOLOGIN feature check for the user returns $isUserElegible",
    async ({ isUserElegible, expectedUriScheme }) => {
      mockGetProfile.mockReturnValueOnce(
        TE.of(ResponseSuccessJson(mockedInitializedProfile)),
      );
      const response = await acs({
        ...dependencies,
        isUserElegibleForIoLoginUrlScheme: () => isUserElegible,
      })(validUserPayload);
      response.apply(res);

      expect(res.redirect).toHaveBeenCalledWith(
        301,
        `${expectedUriScheme}//localhost${getProfileUrlWithToken(mockSessionToken)}`,
      );
      expect(res.clearCookie).toHaveBeenCalledTimes(1);
    },
  );
});

describe("AuthenticationController#acs CIE", () => {
  const anotherFiscalCode = "AAABBB01C02D345Z" as FiscalCode;
  test("should return unauthorized using a CIE test environment with no whitelisted user fiscalcode", async () => {
    const anInvalidCieTestUser = {
      ...validUserPayload,
      fiscalNumber: anotherFiscalCode,
      issuer: Object.keys(CIE_IDP_IDENTIFIERS)[0],
    };

    const response = await acs({
      ...dependencies,
    })(anInvalidCieTestUser);
    response.apply(res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.clearCookie).toHaveBeenCalledTimes(1);
  });

  test.each`
    title                                        | fiscalNumber                     | issuer
    ${"if a CIE TEST user is in whitelist"}      | ${validUserPayload.fiscalNumber} | ${Object.keys(CIE_IDP_IDENTIFIERS)[0]}
    ${"if a user logs to PROD CIE IDP"}          | ${anotherFiscalCode}             | ${Object.keys(CIE_IDP_IDENTIFIERS)[1]}
    ${"if a user logs to another IDP"}           | ${anotherFiscalCode}             | ${"https://id.eht.eu"}
    ${"if  a CIE TEST user logs to another IDP"} | ${validUserPayload.fiscalNumber} | ${"https://id.eht.eu"}
  `(
    "should redirect to success URL $title",
    async ({ fiscalNumber, issuer }) => {
      const whitelistedCieTestUserPayload = {
        ...validUserPayload,
        fiscalNumber,
        issuer,
      };
      const response = await acs({
        ...dependencies,
        allowedCieTestFiscalCodes: [aFiscalCode],
      })(whitelistedCieTestUserPayload);
      response.apply(res);

      expect(res.redirect).toHaveBeenCalledWith(
        301,
        `https://localhost${getProfileUrlWithToken(mockSessionToken)}`,
      );
      expect(res.clearCookie).toHaveBeenCalledTimes(1);
    },
  );

  // this test ensures CIE prod, coll and test URLs are present in the identifiers object.
  // since in the authenticationcontroller we filter the keys based on the prod URL, we ensure here
  // that at least coll and test URLs are in the array, to let the logic work in the controller.
  // instead, if the order of the keys changes, the unit tests above should fail when the library is updated
  test("should verify that the CIE_IDP_IDENTIFIERS urls are present", () => {
    const CIE_IDP_IDENTIFIERS_KEYS = Object.keys(CIE_IDP_IDENTIFIERS);

    const prodUrlFilter = CIE_IDP_IDENTIFIERS_KEYS.filter(
      (k) =>
        k ===
        "https://idserver.servizicie.interno.gov.it/idp/profile/SAML2/POST/SSO",
    );

    // expect prod url to be present
    expect(prodUrlFilter.length).toBe(1);
    // expect at least test and coll urls to be present
    expect(
      CIE_IDP_IDENTIFIERS_KEYS.length - prodUrlFilter.length,
    ).toBeGreaterThanOrEqual(2);
  });
});

const mockIsUserAuthenticationLocked = vi
  .spyOn(AuthenticationLockService, "isUserAuthenticationLocked")
  .mockReturnValue(() => TE.of(false));

describe("AuthenticationController#acs LV", () => {
  const frozenDate = new Date("2025-10-01T00:00:00Z");

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ now: frozenDate });
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  // validSpidL3User has all every field correctly set.
  const validSpidL3UserPayload = {
    authnContextClassRef: SpidLevelEnum["https://www.spid.gov.it/SpidL3"],
    email: aSpidEmailAddress,
    familyName: aValidFamilyname,
    fiscalNumber: aFiscalCode,
    issuer: aValidEntityID,
    dateOfBirth: aValidDateofBirth,
    name: aValidName,
    getAcsOriginalRequest: () => req,
    getAssertionXml: () => aSpidL3LollipopAssertion,
    getSamlResponseXml: () => aSpidL3LollipopAssertion,
  };
  test.each`
    loginType               | isUserElegible | expectedTtlDuration          | expectedLongSessionDuration
    ${LoginTypeEnum.LV}     | ${true}        | ${lvTokenDurationSecs}       | ${lvLongSessionDurationSecs}
    ${LoginTypeEnum.LV}     | ${false}       | ${standardTokenDurationSecs} | ${standardTokenDurationSecs}
    ${LoginTypeEnum.LEGACY} | ${true}        | ${standardTokenDurationSecs} | ${standardTokenDurationSecs}
    ${LoginTypeEnum.LEGACY} | ${false}       | ${standardTokenDurationSecs} | ${standardTokenDurationSecs}
    ${undefined}            | ${true}        | ${standardTokenDurationSecs} | ${standardTokenDurationSecs}
    ${undefined}            | ${false}       | ${standardTokenDurationSecs} | ${standardTokenDurationSecs}
  `(
    "should succeed and return a new token with duration $expectedTtlDuration, ff is $isUserElegible and login is of type $loginType",
    async ({
      loginType,
      expectedTtlDuration,
      expectedLongSessionDuration,
      isUserElegible,
    }) => {
      mockGetLollipopAssertionRefForUser.mockReturnValueOnce(
        TE.of(O.some(anotherAssertionRef)),
      );

      mockGetProfile.mockReturnValueOnce(
        TE.of(ResponseSuccessJson(mockedInitializedProfile)),
      );

      const response = await acs({
        ...dependencies,
        isUserElegibleForFastLogin: () => isUserElegible,
      })(validUserPayload, withoutUndefinedValues({ loginType }));
      response.apply(res);

      expect(mockSet).toHaveBeenCalledWith(
        mockRedisClientSelector,
        expectedTtlDuration,
      );

      if (isUserElegible) {
        expect(mockSetLollipopDataForUser).toHaveBeenCalledWith(
          { ...mockedUser, created_at: frozenDate.getTime() },
          {
            ...lollipopData,
            loginType: loginType ? loginType : LoginTypeEnum.LEGACY,
          },
          expectedLongSessionDuration,
        );
      } else {
        expect(mockSetLollipopAssertionRefForUser).toHaveBeenCalledWith(
          { ...mockedUser, created_at: frozenDate.getTime() },
          lollipopData.assertionRef,
          expectedLongSessionDuration,
        );
      }
      expect(mockActivateLolliPoPKey).toHaveBeenCalledWith(
        expect.objectContaining({
          assertionRef: anotherAssertionRef,
          fiscalCode: mockedUser.fiscal_code,
          assertion: aLollipopAssertion,
          getExpirePubKeyFn: expect.any(Function),
        }),
      );

      expect(mockOnUserLogin).toHaveBeenCalledWith(expectedUserLoginData);

      const { getExpirePubKeyFn } = mockActivateLolliPoPKey.mock.calls[0][0];

      const now = new Date(); // frozenDate "2025-10-01T00:00:00Z"
      const exp = getExpirePubKeyFn();
      const diff = Math.floor((exp.getTime() - now.getTime()) / 1000); // (1790812800000 - 1759276800000) / 1000 = 31536000000 / 1000 = 31536000

      expect(diff).toEqual(expectedLongSessionDuration);

      expect(res.redirect).toHaveBeenCalledWith(
        301,
        expect.stringContaining(getProfileUrlWithToken(mockSessionToken)),
      );
      expect(res.clearCookie).toHaveBeenCalledTimes(1);
    },
  );

  test("should return a new token when user is eligible for LV and login level === SpidL3", async () => {
    mockGetLollipopAssertionRefForUser.mockReturnValueOnce(
      TE.of(O.some(anotherAssertionRef)),
    );

    mockGetProfile.mockReturnValueOnce(
      TE.of(ResponseSuccessJson(mockedInitializedProfile)),
    );

    const response = await acs({
      ...dependencies,
      isUserElegibleForFastLogin: () => true,
    })(validSpidL3UserPayload, { loginType: LoginTypeEnum.LV });
    response.apply(res);

    expect(mockIsUserAuthenticationLocked).not.toHaveBeenCalled();

    expect(res.redirect).toHaveBeenCalledWith(
      301,
      expect.stringContaining(getProfileUrlWithToken(mockSessionToken)),
    );
    expect(res.clearCookie).toHaveBeenCalledTimes(1);
  });

  test("should return a new token when user is NOT eligible for LV, regardless of the auth lock status", async () => {
    mockIsUserAuthenticationLocked.mockReturnValueOnce(() => TE.of(true));

    mockGetLollipopAssertionRefForUser.mockReturnValueOnce(
      TE.of(O.some(anotherAssertionRef)),
    );

    mockGetProfile.mockReturnValueOnce(
      TE.of(ResponseSuccessJson(mockedInitializedProfile)),
    );

    const response = await acs({
      ...dependencies,
      isUserElegibleForFastLogin: () => false,
    })(validUserPayload, { loginType: LoginTypeEnum.LV });
    response.apply(res);

    expect(res.redirect).toHaveBeenCalledWith(
      301,
      expect.stringContaining(getProfileUrlWithToken(mockSessionToken)),
    );
    expect(res.clearCookie).toHaveBeenCalledTimes(1);
  });

  test("should redirect to error page with AUTHENTICATION_LOCKED_ERROR code when user is eligible for LV, user auth is locked and login level < SpidL3", async () => {
    mockIsUserAuthenticationLocked.mockReturnValueOnce(() => TE.of(true));

    const response = await acs({
      ...dependencies,
      isUserElegibleForFastLogin: () => true,
    })(validUserPayload, { loginType: LoginTypeEnum.LV });
    response.apply(res);

    expect(res.redirect).toHaveBeenCalledWith(
      301,
      expect.stringContaining(
        `/error.html?errorCode=${AUTHENTICATION_LOCKED_ERROR}`,
      ),
    );

    expect(mockEmitSessionEvent).toHaveBeenCalledExactlyOnceWith({
      eventType: EventTypeEnum.REJECTED_LOGIN,
      rejectionCause: RejectedLoginCauseEnum.AUTH_LOCK,
      fiscalCode: validUserPayload.fiscalNumber,
      ip: aRequestIpAddress,
      ts: frozenDate,
      loginId: anotherAssertionRef,
    });

    expect(res.clearCookie).toHaveBeenCalledTimes(1);
  });
});

describe("AuthenticationController#acs LV Notify user login", () => {
  test("should notify new login with profile email if profile does not exists and user is eligible", async () => {
    const response = await acs({
      ...dependencies,
      isUserElegibleForFastLogin: () => true,
    })(validUserPayload);
    response.apply(res);

    expect(res.redirect).toHaveBeenCalledWith(
      301,
      expect.stringContaining(getProfileUrlWithToken(mockSessionToken)),
    );
    expect(res.clearCookie).toHaveBeenCalledTimes(1);
    expect(mockSet).toHaveBeenCalledWith(
      mockRedisClientSelector,
      standardTokenDurationSecs,
    );

    expect(mockOnUserLogin).toHaveBeenCalledWith({
      ...expectedUserLoginData,
      // new profile created has always is_email_validated to false
      // with email uniqueness feature
      is_email_validated: false,
      email: validUserPayload.email,
    });
  });

  test("should notify new login with spid email if profile exists, email is not validated and user is eligible", async () => {
    mockGetProfile.mockReturnValueOnce(
      TE.of(
        ResponseSuccessJson({
          ...mockedInitializedProfile,
          is_email_validated: undefined,
        }),
      ),
    );

    const response = await acs({
      ...dependencies,
      isUserElegibleForFastLogin: () => true,
    })(validUserPayload);
    response.apply(res);

    expect(res.redirect).toHaveBeenCalledWith(
      301,
      expect.stringContaining(getProfileUrlWithToken(mockSessionToken)),
    );
    expect(res.clearCookie).toHaveBeenCalledTimes(1);

    expect(mockOnUserLogin).toHaveBeenCalledWith({
      ...expectedUserLoginData,
      email: validUserPayload.email,
      is_email_validated: undefined,
    });
  });

  test("should delete Lollipop data when onUserLogin call fails", async () => {
    mockOnUserLogin.mockReturnValueOnce(() =>
      TE.left(new Error("Error calling notify endpoint")),
    );

    mockGetProfile.mockReturnValueOnce(
      TE.of(
        ResponseSuccessJson({
          ...mockedInitializedProfile,
          is_email_validated: undefined,
        }),
      ),
    );

    const response = await acs({
      ...dependencies,
      isUserElegibleForFastLogin: () => true,
    })(validUserPayload);
    response.apply(res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.clearCookie).toHaveBeenCalledTimes(1);

    expect(mockOnUserLogin).toHaveBeenCalled();
    expect(mockDelLollipopDataForUser).toHaveBeenCalledTimes(1);
    expect(mockDeleteAssertionRefAssociation).toHaveBeenCalledTimes(1);

    expect(mockedAppinsightsTelemetryClient.trackEvent).toHaveBeenNthCalledWith(
      // 1st call is dedicated to validation_cookie missing
      2,
      expect.objectContaining({
        name: "lollipop.error.acs.notify",
        properties: {
          error: "Error calling notify endpoint",
          fiscal_code: sha256(validUserPayload.fiscalNumber),
          message: "acs: Unable to notify user login event",
        },
      }),
    );
  });
});

describe("AuthenticationController#acs cookie validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const cookieValidationScenarioDeps = {
    ...dependencies,
    isUserElegibleForValidationCookie: () => true,
  };
  const validUserPayloadWithCookie = {
    ...validUserPayload,
    getAcsOriginalRequest: () =>
      mockReq({
        cookies: { [VALIDATION_COOKIE_NAME]: anotherAssertionRef },
      }),
  };

  test("should redirect with cookie clearance with lollipop request", async () => {
    const response = await acs(cookieValidationScenarioDeps)(
      validUserPayloadWithCookie,
    );
    response.apply(res);

    expect(res.redirect).toHaveBeenCalledWith(
      301,
      expect.stringContaining(getProfileUrlWithToken(mockSessionToken)),
    );
    expect(mockGetLollipopAssertionRefForUser).toHaveBeenCalledTimes(1);
    expect(res.clearCookie).toHaveBeenCalledTimes(1);
    expect(res.clearCookie).toHaveBeenCalledWith(VALIDATION_COOKIE_NAME, {
      ...VALIDATION_COOKIE_SETTINGS,
      maxAge: undefined,
      expires: undefined,
    });
    expect(mockTrackEvent).not.toHaveBeenCalled();
  });

  test("should track cookie mismatch event if FF is off", async () => {
    const invalidCookieValue = "WRONG";
    const invalidUserPayloadWithCookie = {
      ...validUserPayload,
      getAcsOriginalRequest: () =>
        mockReq({
          cookies: { [VALIDATION_COOKIE_NAME]: invalidCookieValue },
        }),
    };

    const response = await acs({
      ...cookieValidationScenarioDeps,
      isUserElegibleForValidationCookie: () => false,
    })(invalidUserPayloadWithCookie);
    response.apply(res);

    expect(res.redirect).toHaveBeenCalledWith(
      301,
      expect.stringContaining(getProfileUrlWithToken(mockSessionToken)),
    );
    expect(mockGetLollipopAssertionRefForUser).toHaveBeenCalledTimes(1);
    expect(res.clearCookie).toHaveBeenCalledTimes(1);
    expect(res.clearCookie).toHaveBeenCalledWith(VALIDATION_COOKIE_NAME, {
      ...VALIDATION_COOKIE_SETTINGS,
      maxAge: undefined,
      expires: undefined,
    });
    expect(mockTrackEvent).toHaveBeenCalledTimes(1);
    expect(mockTrackEvent).toHaveBeenCalledWith({
      name: "acs.error.validation_cookie_mismatch",
      properties: expect.objectContaining({
        assertionRef: anotherAssertionRef,
        issuer: invalidUserPayloadWithCookie.issuer,
        received_cookie: invalidCookieValue,
      }),
      tagOverrides: {
        samplingEnabled: "false",
      },
    });
  });

  test("should error with cookie clearance on missing cookie", async () => {
    const response = await acs(cookieValidationScenarioDeps)(validUserPayload);
    response.apply(res);

    expect(res.redirect).toHaveBeenCalledWith(
      301,
      expect.stringContaining(
        `error.html?errorCode=${AuthController.VALIDATION_COOKIE_ERROR_CODE}&errorMessage=Validation%20error`,
      ),
    );
    expect(mockGetLollipopAssertionRefForUser).toHaveBeenCalledTimes(1);
    expect(res.clearCookie).toHaveBeenCalledTimes(1);
    expect(mockTrackEvent).toHaveBeenCalledTimes(1);
    expect(mockTrackEvent).toHaveBeenCalledWith({
      name: "acs.error.validation_cookie_missing",
      properties: expect.objectContaining({
        assertionRef: anotherAssertionRef,
        issuer: validUserPayload.issuer,
      }),
      tagOverrides: {
        samplingEnabled: "false",
      },
    });
  });

  test("should error with cookie clearance on wrong cookie value", async () => {
    const invalidCookieValue = "WRONG";
    const invalidUserPayloadWithCookie = {
      ...validUserPayload,
      getAcsOriginalRequest: () =>
        mockReq({
          cookies: { [VALIDATION_COOKIE_NAME]: invalidCookieValue },
        }),
    };
    const response = await acs(cookieValidationScenarioDeps)(
      invalidUserPayloadWithCookie,
    );
    response.apply(res);

    expect(res.redirect).toHaveBeenCalledWith(
      301,
      expect.stringContaining(
        `error.html?errorCode=${AuthController.VALIDATION_COOKIE_ERROR_CODE}&errorMessage=Validation%20error`,
      ),
    );
    expect(mockGetLollipopAssertionRefForUser).toHaveBeenCalledTimes(1);
    expect(res.clearCookie).toHaveBeenCalledTimes(1);
    expect(mockTrackEvent).toHaveBeenCalledTimes(1);
    expect(mockTrackEvent).toHaveBeenCalledWith({
      name: "acs.error.validation_cookie_mismatch",
      properties: expect.objectContaining({
        assertionRef: anotherAssertionRef,
        issuer: validUserPayload.issuer,
        received_cookie: invalidCookieValue,
      }),
      tagOverrides: {
        samplingEnabled: "false",
      },
    });
  });
});

describe("AuthenticationController#acs service bus login events", () => {
  const frozenDate = new Date("2023-10-01T00:00:00Z");

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ now: frozenDate });
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  const serviceBusEventsScenarioDeps = {
    ...dependencies,
  };

  test("should emit a login event", async () => {
    const response = await acs(serviceBusEventsScenarioDeps)(validUserPayload);
    response.apply(res);

    expect(mockEmitSessionEvent).toHaveBeenCalledTimes(1);
    expect(mockEmitSessionEvent).toHaveBeenCalledWith({
      eventType: EventTypeEnum.LOGIN,
      fiscalCode: validUserPayload.fiscalNumber,
      loginType: ServiceBusLoginTypeEnum.LEGACY,
      scenario: LoginScenarioEnum.NEW_USER,
      expiredAt: addSeconds(frozenDate, standardTokenDurationSecs),
      ts: frozenDate,
      idp: validUserPayload.issuer,
    } as LoginEvent);
  });

  test("should emit a login event with login scenario 'standard' when profile exists", async () => {
    mockGetProfile.mockReturnValueOnce(
      TE.of(ResponseSuccessJson(mockedInitializedProfile)),
    );

    const response = await acs(serviceBusEventsScenarioDeps)(validUserPayload);
    response.apply(res);

    expect(mockEmitSessionEvent).toHaveBeenCalledTimes(1);
    expect(mockEmitSessionEvent).toHaveBeenCalledWith({
      eventType: EventTypeEnum.LOGIN,
      fiscalCode: validUserPayload.fiscalNumber,
      loginType: ServiceBusLoginTypeEnum.LEGACY,
      scenario: LoginScenarioEnum.STANDARD,
      expiredAt: addSeconds(frozenDate, standardTokenDurationSecs),
      ts: frozenDate,
      idp: validUserPayload.issuer,
    } as LoginEvent);
  });

  test("should emit a login event with login scenario 'relogin' when profile exists and is an active session login", async () => {
    const additionalProps = {
      currentUser: sha256(validUserPayload.fiscalNumber),
    };
    mockGetProfile.mockReturnValueOnce(
      TE.of(ResponseSuccessJson(mockedInitializedProfile)),
    );

    const response = await acs(serviceBusEventsScenarioDeps)(
      validUserPayload,
      additionalProps,
    );
    response.apply(res);

    expect(mockEmitSessionEvent).toHaveBeenCalledTimes(1);
    expect(mockEmitSessionEvent).toHaveBeenCalledWith({
      eventType: EventTypeEnum.LOGIN,
      fiscalCode: validUserPayload.fiscalNumber,
      loginType: ServiceBusLoginTypeEnum.LEGACY,
      scenario: LoginScenarioEnum.RELOGIN,
      expiredAt: addSeconds(frozenDate, standardTokenDurationSecs),
      ts: frozenDate,
      idp: validUserPayload.issuer,
    } as LoginEvent);
  });

  test("should emit a login event with login type 'lv'", async () => {
    mockGetProfile.mockReturnValueOnce(
      TE.of(ResponseSuccessJson(mockedInitializedProfile)),
    );

    const response = await acs({
      ...serviceBusEventsScenarioDeps,
      isUserElegibleForFastLogin: () => true,
    })(validUserPayload, {
      loginType: LoginTypeEnum.LV,
    });
    response.apply(res);

    expect(mockEmitSessionEvent).toHaveBeenCalledTimes(1);
    expect(mockEmitSessionEvent).toHaveBeenCalledWith({
      eventType: EventTypeEnum.LOGIN,
      fiscalCode: validUserPayload.fiscalNumber,
      loginType: ServiceBusLoginTypeEnum.LV,
      scenario: LoginScenarioEnum.STANDARD,
      expiredAt: addSeconds(frozenDate, lvLongSessionDurationSecs),
      ts: frozenDate,
      idp: validUserPayload.issuer,
    } as LoginEvent);
  });
});

describe("AuthenticationController#acsTest", () => {
  const acsSpyOn = vi.spyOn(AuthController, "acs");
  beforeEach(() => {
    vi.clearAllMocks();
    resetMock(res as unknown as ReturnType<typeof mockRes>);
  });
  afterAll(() => {
    acsSpyOn.mockRestore();
  });
  test("should return ResponseSuccessJson with a valid token if acs succeeded", async () => {
    const expectedToken = "token-111-222";
    acsSpyOn.mockReturnValueOnce(async (_: unknown) =>
      withCookieClearanceResponsePermanentRedirect(
        getClientProfileRedirectionUrl(expectedToken),
        VALIDATION_COOKIE_NAME,
        VALIDATION_COOKIE_SETTINGS,
      ),
    );
    const response = await acsTest(validUserPayload)({
      ...dependencies,
    })();
    expect(response).toEqual(
      E.right(
        toExpectedResponse(ResponseSuccessJson({ token: expectedToken })),
      ),
    );
  });

  test("should return the same response of acs if is different from SuccessPermanentRedirect", async () => {
    const expectedResponse = ResponseErrorValidation(
      "Validation error",
      "Validation error message",
    );
    acsSpyOn.mockReturnValueOnce(async (_: unknown) => expectedResponse);
    const response = await acsTest(validUserPayload)({
      ...dependencies,
    })();

    expect(response).toEqual(E.right(toExpectedResponse(expectedResponse)));
  });

  test("should return ResponseErrorInternal if the token is missing", async () => {
    acsSpyOn.mockReturnValueOnce(async (_: unknown) =>
      withCookieClearanceResponsePermanentRedirect(
        {
          href: "https://invalid-url",
        } as ValidUrl,
        VALIDATION_COOKIE_NAME,
        VALIDATION_COOKIE_SETTINGS,
      ),
    );
    const response = await acsTest(validUserPayload)({
      ...dependencies,
    })();

    expect(response).toEqual(
      E.right(
        toExpectedResponse(ResponseErrorInternal("Unexpected redirection url")),
      ),
    );
  });

  test("should return ResponseErrorInternal if the token decode fails", async () => {
    acsSpyOn.mockReturnValueOnce(async (_: unknown) =>
      withCookieClearanceResponsePermanentRedirect(
        getClientProfileRedirectionUrl(""),
        VALIDATION_COOKIE_NAME,
        VALIDATION_COOKIE_SETTINGS,
      ),
    );
    const response = await acsTest(validUserPayload)({
      ...dependencies,
    })();
    expect(response).toEqual(
      E.right(
        toExpectedResponse({
          detail: expect.stringContaining("Decode Error:"),
          kind: "IResponseErrorInternal",
        }),
      ),
    );
  });
});
