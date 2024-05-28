import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  ResponseErrorInternal,
  ResponseErrorNotFound,
  ResponseSuccessJson,
} from "@pagopa/ts-commons/lib/responses";
import { Response } from "express";
import {
  CIE_IDP_IDENTIFIERS,
  IDP_NAMES,
  Issuer,
  SPID_IDP_IDENTIFIERS,
} from "@pagopa/io-spid-commons/dist/config";
import * as TE from "fp-ts/TaskEither";
import { addDays, addMonths, format, subYears } from "date-fns";
import * as O from "fp-ts/Option";
import { sha256 } from "@pagopa/io-functions-commons/dist/src/utils/crypto";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import { withoutUndefinedValues } from "@pagopa/ts-commons/lib/types";
import {
  AGE_LIMIT,
  AGE_LIMIT_ERROR_CODE,
  AUTHENTICATION_LOCKED_ERROR,
  AcsDependencies,
  acs,
} from "../authentication";
import { mockedFnAppAPIClient } from "../../__mocks__/repositories/fn-app-api-mocks";
import { mockedTableClient } from "../../__mocks__/repositories/table-client-mocks";
import { mockQueueClient } from "../../__mocks__/repositories/queue-client.mocks";
import { mockedLollipopApiClient } from "../../__mocks__/repositories/lollipop-api.mocks";
import {
  getClientErrorRedirectionUrl,
  getClientProfileRedirectionUrl,
} from "../../config/spid";
import { standardTokenDurationSecs } from "../../config/login";
import {
  lvLongSessionDurationSecs,
  lvTokenDurationSecs,
} from "../../config/fast-login";
import { mockRedisClientSelector } from "../../__mocks__/redis.mocks";
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
import {
  aLollipopAssertion,
  aSpidL3LollipopAssertion,
  anAssertionRef,
  anotherAssertionRef,
  lollipopData,
} from "../../__mocks__/lollipop.mocks";
import mockReq from "../../__mocks__/request.mocks";
import mockRes, { resetMock } from "../../__mocks__/response.mocks";
import {
  AuthenticationLockService,
  LoginService,
  LollipopService,
  ProfileService,
  RedisSessionStorageService,
  TokenService,
} from "../../services";
import { SpidUser } from "../../types/user";
import { PubKeyStatusEnum } from "../../generated/lollipop-api/PubKeyStatus";
import { AssertionRef } from "../../generated/lollipop-api/AssertionRef";
import { AssertionTypeEnum } from "../../generated/fast-login-api/AssertionType";
import { JwkPubKey } from "../../generated/lollipop-api/JwkPubKey";
import { ActivatedPubKey } from "../../generated/lollipop-api/ActivatedPubKey";
import { LollipopRevokeRepo } from "../../repositories";
import { LoginTypeEnum } from "../../types/fast-login";
import { SpidLevelEnum } from "../../types/spid-level";

const mockTelemetryClient = {
  trackEvent: vi.fn(),
};

const dependencies: AcsDependencies = {
  redisClientSelector: mockRedisClientSelector,
  fnAppAPIClient: mockedFnAppAPIClient,
  lockUserTableClient: mockedTableClient,
  loginUserEventQueue: mockQueueClient,
  fnLollipopAPIClient: mockedLollipopApiClient,
  lollipopRevokeQueueClient: mockQueueClient,
  testLoginFiscalCodes: [],
  FF_UNIQUE_EMAIL_ENFORCEMENT_ENABLED: () => true,
  isSpidEmailPersistenceEnabled: true,
  notificationQueueClient: mockQueueClient,
  isLollipopEnabled: false,
  getClientErrorRedirectionUrl,
  getClientProfileRedirectionUrl,
  allowedCieTestFiscalCodes: [],
  hasUserAgeLimitEnabled: true,
  standardTokenDurationSecs,
  lvTokenDurationSecs,
  lvLongSessionDurationSecs,
  isUserElegibleForIoLoginUrlScheme: () => false,
  appInsightsTelemetryClient: mockTelemetryClient,
  isUserElegibleForFastLogin: () => false,
};

const req = mockReq();
// eslint-disable-next-line functional/immutable-data
req.ip = "127.0.0.2";
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
  .mockReturnValue(({ FF_UNIQUE_EMAIL_ENFORCEMENT_ENABLED }) =>
    TE.of(
      ResponseSuccessJson({
        ...mockedInitializedProfile,
        is_email_validated: !FF_UNIQUE_EMAIL_ENFORCEMENT_ENABLED(
          "" as FiscalCode,
        ),
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
  ip_address: "127.0.0.2",
  name: mockedInitializedProfile.name,
  is_email_validated: mockedInitializedProfile.is_email_validated,
};

const res = mockRes() as unknown as Response;

const getProfileUrlWithToken = (token: string) =>
  "/profile.html?token=" + token;

beforeEach(() => {
  vi.clearAllMocks();
  resetMock(res as unknown as ReturnType<typeof mockRes>);
  setupGetNewTokensMocks();
});

describe("AuthenticationController#acs", () => {
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

    expect(mockOnUserLogin).not.toHaveBeenCalled();
  });

  test("should fail if a profile cannot be created", async () => {
    mockCreateProfile.mockReturnValueOnce(() =>
      TE.of(ResponseErrorInternal("Error creating new user profile")),
    );
    const response = await acs(dependencies)(validUserPayload);
    response.apply(res);

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

    expect(res.json).toHaveBeenCalledWith(badRequestErrorResponse);
    expect(mockSet).not.toHaveBeenCalled();
  });

  test("should fail if the session can not be saved", async () => {
    mockSet.mockReturnValueOnce(() => TE.of(false));

    const response = await acs(dependencies)(validUserPayload);
    response.apply(res);

    expect(res.status).toHaveBeenCalledWith(500);
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
  });

  test("should fail if Redis Client returns an error while getting info on user blocked", async () => {
    mockIsBlockedUser.mockReturnValueOnce(TE.left(new Error("Redis error")));

    const response = await acs(dependencies)(validUserPayload);
    response.apply(res);

    expect(res.status).toHaveBeenCalledWith(500);
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
    expect(res.json).toHaveBeenCalledWith({
      ...anErrorResponse,
      detail: "Error while creating the user session",
    });
  });
});

describe("AuthenticationController#acs Age Limit", () => {
  test(`should return unauthorized if the user is younger than ${AGE_LIMIT} yo`, async () => {
    const aYoungUserPayload: SpidUser = {
      ...validUserPayload,
      dateOfBirth: format(
        addDays(subYears(new Date(), AGE_LIMIT), 1),
        "YYYY-MM-DD",
      ),
    };
    const response = await acs(dependencies)(aYoungUserPayload);
    response.apply(res);

    expect(mockTelemetryClient.trackEvent).toBeCalledWith(
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

    expect(mockTelemetryClient.trackEvent).toBeCalledWith(
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
  });

  test(`should redirects to the correct url if the user has ${AGE_LIMIT} yo`, async () => {
    const aYoungUserPayload: SpidUser = {
      ...validUserPayload,
      dateOfBirth: format(subYears(new Date(), AGE_LIMIT), "YYYY-MM-DD"),
    };
    const response = await acs(dependencies)(aYoungUserPayload);
    response.apply(res);

    expect(mockTelemetryClient.trackEvent).not.toBeCalled();
    expect(res.redirect).toHaveBeenCalledWith(
      301,
      expect.stringContaining(getProfileUrlWithToken(mockSessionToken)),
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
  test(`redirects to the correct url using the lollipop features`, async () => {
    mockGetProfile.mockReturnValueOnce(
      TE.of(ResponseSuccessJson(mockedInitializedProfile)),
    );

    const response = await acs({ ...dependencies, isLollipopEnabled: true })(
      validUserPayload,
    );
    response.apply(res);
    await new Promise((resolve) => setTimeout(() => resolve(""), 10));

    expect(res.redirect).toHaveBeenCalledWith(
      301,
      expect.stringContaining(getProfileUrlWithToken(mockSessionToken)),
    );

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
        appInsightsTelemetryClient: mockTelemetryClient,
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

    const response = await acs({ ...dependencies, isLollipopEnabled: true })(
      validUserPayload,
    );
    response.apply(res);
    await new Promise((resolve) => setTimeout(() => resolve(""), 10));

    expect(res.status).toHaveBeenCalledWith(500);

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

      const response = await acs({ ...dependencies, isLollipopEnabled: true })(
        validUserPayload,
        req,
      );
      response.apply(res);

      expect(mockTelemetryClient.trackEvent).toHaveBeenCalledWith({
        name: "lollipop.error.acs",
        properties: expect.objectContaining({
          assertion_ref: anotherAssertionRef,
          fiscal_code: sha256(aFiscalCode),
          message: errorMessage,
        }),
      });

      expect(res.status).toHaveBeenCalledWith(500);
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

    const response = await acs({ ...dependencies, isLollipopEnabled: true })(
      validUserPayload,
      req,
    );
    response.apply(res);
    await new Promise((resolve) => setTimeout(() => resolve(""), 100));

    expect(res.status).toHaveBeenCalledWith(500);
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
        appInsightsTelemetryClient: mockTelemetryClient,
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

      const response = await acs({ ...dependencies, isLollipopEnabled: true })(
        validUserPayload,
        req,
      );
      response.apply(res);

      expect(mockTelemetryClient.trackEvent).toHaveBeenCalledWith({
        name: "lollipop.error.acs",
        properties: expect.objectContaining({
          fiscal_code: sha256(aFiscalCode),
          message: `acs: ${errorMessage}`,
        }),
      });

      expect(res.status).toHaveBeenCalledWith(500);
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
    mockGetLollipopAssertionRefForUser.mockReturnValue(
      TE.left(new Error("Error")),
    );

    const response = await acs({ ...dependencies, isLollipopEnabled: true })(
      validUserPayload,
      req,
    );
    response.apply(res);

    expect(mockTelemetryClient.trackEvent).toHaveBeenCalledWith({
      name: "lollipop.error.acs",
      properties: expect.objectContaining({
        fiscal_code: sha256(aFiscalCode),
        message: "Error retrieving previous lollipop configuration",
      }),
    });

    expect(res.status).toHaveBeenCalledWith(500);
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
        `${expectedUriScheme}//localhost/profile.html?token=` +
          mockSessionToken,
      );
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
        "https://localhost/profile.html?token=" + mockSessionToken,
      );
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
    loginType               | isLollipopEnabled | isUserElegible | expectedTtlDuration          | expectedLongSessionDuration
    ${LoginTypeEnum.LV}     | ${true}           | ${true}        | ${lvTokenDurationSecs}       | ${lvLongSessionDurationSecs}
    ${LoginTypeEnum.LV}     | ${true}           | ${false}       | ${standardTokenDurationSecs} | ${standardTokenDurationSecs}
    ${LoginTypeEnum.LEGACY} | ${true}           | ${true}        | ${standardTokenDurationSecs} | ${standardTokenDurationSecs}
    ${LoginTypeEnum.LEGACY} | ${true}           | ${false}       | ${standardTokenDurationSecs} | ${standardTokenDurationSecs}
    ${undefined}            | ${true}           | ${true}        | ${standardTokenDurationSecs} | ${standardTokenDurationSecs}
    ${undefined}            | ${true}           | ${false}       | ${standardTokenDurationSecs} | ${standardTokenDurationSecs}
    ${LoginTypeEnum.LV}     | ${false}          | ${true}        | ${standardTokenDurationSecs} | ${standardTokenDurationSecs}
    ${LoginTypeEnum.LV}     | ${false}          | ${false}       | ${standardTokenDurationSecs} | ${standardTokenDurationSecs}
    ${LoginTypeEnum.LEGACY} | ${false}          | ${true}        | ${standardTokenDurationSecs} | ${standardTokenDurationSecs}
    ${LoginTypeEnum.LEGACY} | ${false}          | ${false}       | ${standardTokenDurationSecs} | ${standardTokenDurationSecs}
    ${undefined}            | ${false}          | ${true}        | ${standardTokenDurationSecs} | ${standardTokenDurationSecs}
    ${undefined}            | ${false}          | ${false}       | ${standardTokenDurationSecs} | ${standardTokenDurationSecs}
  `(
    "should succeed and return a new token with duration $expectedTtlDuration, if lollipop is enabled $isLollipopEnabled, ff is $isUserElegible and login is of type $loginType",
    async ({
      loginType,
      isLollipopEnabled,
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
        isLollipopEnabled,
        isUserElegibleForFastLogin: () => isUserElegible,
      })(validUserPayload, withoutUndefinedValues({ loginType }));
      response.apply(res);

      expect(mockSet).toHaveBeenCalledWith(
        mockRedisClientSelector,
        expectedTtlDuration,
      );

      if (isLollipopEnabled) {
        if (isUserElegible) {
          expect(mockSetLollipopDataForUser).toHaveBeenCalledWith(
            { ...mockedUser, created_at: expect.any(Number) }, // TODO: mock date
            {
              ...lollipopData,
              loginType: loginType ? loginType : LoginTypeEnum.LEGACY,
            },
            expectedLongSessionDuration,
          );
        } else {
          expect(mockSetLollipopAssertionRefForUser).toHaveBeenCalledWith(
            { ...mockedUser, created_at: expect.any(Number) }, // TODO: mock date,
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

        if (isUserElegible) {
          expect(mockOnUserLogin).toHaveBeenCalledWith(expectedUserLoginData);
        } else {
          expect(mockOnUserLogin).not.toHaveBeenCalled();
        }

        const { getExpirePubKeyFn } = mockActivateLolliPoPKey.mock.calls[0][0];

        const now = new Date();
        const exp = getExpirePubKeyFn() as Date;
        const diff = (exp.getTime() - now.getTime()) / 1000;

        expect(diff).toEqual(expectedLongSessionDuration);
      } else {
        expect(mockSetLollipopAssertionRefForUser).not.toHaveBeenCalled();
        expect(mockActivateLolliPoPKey).not.toHaveBeenCalled();
        expect(mockOnUserLogin).not.toHaveBeenCalled();
      }

      expect(res.redirect).toHaveBeenCalledWith(
        301,
        expect.stringContaining("/profile.html?token=" + mockSessionToken),
      );
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
      isLollipopEnabled: true,
      isUserElegibleForFastLogin: () => true,
    })(validSpidL3UserPayload, { loginType: LoginTypeEnum.LV });
    response.apply(res);

    expect(mockIsUserAuthenticationLocked).not.toHaveBeenCalled();

    expect(res.redirect).toHaveBeenCalledWith(
      301,
      expect.stringContaining("/profile.html?token=" + mockSessionToken),
    );
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
      isLollipopEnabled: true,
      isUserElegibleForFastLogin: () => false,
    })(validUserPayload, { loginType: LoginTypeEnum.LV });
    response.apply(res);

    expect(res.redirect).toHaveBeenCalledWith(
      301,
      expect.stringContaining("/profile.html?token=" + mockSessionToken),
    );
  });

  test("should redirect to error page with AUTHENTICATION_LOCKED_ERROR code when user is eligible for LV, user auth is locked and login level < SpidL3", async () => {
    mockIsUserAuthenticationLocked.mockReturnValueOnce(() => TE.of(true));

    const response = await acs({
      ...dependencies,
      isLollipopEnabled: true,
      isUserElegibleForFastLogin: () => true,
    })(validUserPayload, { loginType: LoginTypeEnum.LV });
    response.apply(res);

    expect(res.redirect).toHaveBeenCalledWith(
      301,
      expect.stringContaining(
        `/error.html?errorCode=${AUTHENTICATION_LOCKED_ERROR}`,
      ),
    );
  });
});

describe("AuthenticationController#acs LV Notify user login", () => {
  test("should notify new login with profile email if profile does not exists and user is eligible", async () => {
    const response = await acs({
      ...dependencies,
      isLollipopEnabled: true,
      isUserElegibleForFastLogin: () => true,
    })(validUserPayload);
    response.apply(res);

    expect(res.redirect).toHaveBeenCalledWith(
      301,
      expect.stringContaining("/profile.html?token=" + mockSessionToken),
    );
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
      isLollipopEnabled: true,
      isUserElegibleForFastLogin: () => true,
    })(validUserPayload);
    response.apply(res);

    expect(res.redirect).toHaveBeenCalledWith(
      301,
      expect.stringContaining("/profile.html?token=" + mockSessionToken),
    );

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
      isLollipopEnabled: true,
      isUserElegibleForFastLogin: () => true,
    })(validUserPayload);
    response.apply(res);

    expect(res.status).toHaveBeenCalledWith(500);

    expect(mockOnUserLogin).toHaveBeenCalled();
    expect(mockDelLollipopDataForUser).toHaveBeenCalledTimes(1);
    expect(mockDeleteAssertionRefAssociation).toHaveBeenCalledTimes(1);

    expect(mockTelemetryClient.trackEvent).toHaveBeenNthCalledWith(
      1,
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
