/* eslint-disable max-lines-per-function */
import { EventTypeEnum } from "@pagopa/io-auth-n-identity-commons/types/session-events/event-type";

import {
  LoginEvent,
  LoginScenarioEnum,
  LoginTypeEnum as ServiceBusLoginTypeEnum,
} from "@pagopa/io-auth-n-identity-commons/types/session-events/login-event";

import {
  BaseRejectedLoginEventContent,
  RejectedLoginCauseEnum,
  RejectedLoginEvent,
} from "@pagopa/io-auth-n-identity-commons/types/session-events/rejected-login-event";
import { sha256 } from "@pagopa/io-functions-commons/dist/src/utils/crypto";
import { AssertionConsumerServiceT } from "@pagopa/io-spid-commons";
import { IDP_NAMES, Issuer } from "@pagopa/io-spid-commons/dist/config";
import { safeXMLParseFromString } from "@pagopa/io-spid-commons/dist/utils/samlUtils";
import {
  errorsToReadableMessages,
  readableReportSimplified,
} from "@pagopa/ts-commons/lib/reporters";
import {
  IResponseErrorForbiddenNotAuthorized,
  IResponseErrorInternal,
  IResponseErrorValidation,
  IResponsePermanentRedirect,
  IResponseSuccessJson,
  ResponseSuccessJson,
} from "@pagopa/ts-commons/lib/responses";
import {
  EmailString,
  FiscalCode,
  IPString,
  NonEmptyString,
} from "@pagopa/ts-commons/lib/strings";
import { Second } from "@pagopa/ts-commons/lib/units";
import { UrlFromString } from "@pagopa/ts-commons/lib/url";
import { addSeconds, parse } from "date-fns";
import * as E from "fp-ts/Either";
import * as B from "fp-ts/lib/boolean";
import { flow, pipe } from "fp-ts/lib/function";
import * as RR from "fp-ts/lib/ReadonlyRecord";
import * as O from "fp-ts/Option";
import * as RT from "fp-ts/ReaderTask";
import * as T from "fp-ts/Task";
import * as TE from "fp-ts/TaskEither";
import {
  ClientErrorRedirectionUrlParams,
  getClientErrorRedirectionUrl,
} from "../config/spid";
import {
  VALIDATION_COOKIE_NAME,
  VALIDATION_COOKIE_SETTINGS,
} from "../config/validation-cookie";
import { AssertionRef } from "../generated/backend/AssertionRef";
import { UserLoginParams } from "../generated/io-profile/UserLoginParams";
import { AccessToken } from "../generated/public/AccessToken";
import {
  AuthSessionEventsRepo,
  FnLollipopRepo,
  LollipopRevokeRepo,
  NotificationsRepo,
  RedisRepo,
} from "../repositories";
import { FnAppAPIRepositoryDeps } from "../repositories/fn-app-api";
import { LockUserAuthenticationDeps } from "../repositories/locked-profiles";
import { RevokeAssertionRefDeps } from "../repositories/lollipop-revoke-queue";
import {
  AuthenticationLockService,
  LoginService,
  LollipopService,
  ProfileService,
  RedisSessionStorageService,
  TokenService,
} from "../services";
import { CreateNewProfileDependencies } from "../services/profile";
import { Sha256HexString } from "../types/crypto";
import { AdditionalLoginPropsT, LoginTypeEnum } from "../types/fast-login";
import { isSpidL3 } from "../types/spid";
import {
  BPDToken,
  FIMSToken,
  MyPortalToken,
  SessionToken,
  WalletToken,
  ZendeskToken,
} from "../types/token";
import { SpidUser } from "../types/user";
import { AppInsightsDeps } from "../utils/appinsights";
import {
  getIsUserElegibleForCIETestEnv,
  isCIETestEnvLogin,
} from "../utils/cie";
import { isOlderThan } from "../utils/date";
import { acsRequestMapper, getLoginTypeOnElegible } from "../utils/fast-login";
import { log } from "../utils/logger";
import {
  getIsUserElegibleForIoLoginUrlScheme,
  internalErrorOrIoLoginRedirect,
} from "../utils/login-uri-scheme";
import {
  withCookieClearanceResponseErrorInternal,
  withCookieClearanceResponseErrorValidation,
  withCookieClearanceResponseForbidden,
  withCookieClearanceResponsePermanentRedirect,
} from "../utils/responses";
import { getRequestIDFromResponse } from "../utils/spid";
import { toAppUser, validateSpidUser } from "../utils/user";
import { SESSION_ID_LENGTH_BYTES, SESSION_TOKEN_LENGTH_BYTES } from "./session";
import { AuthenticationController } from ".";

// Minimum user age allowed to login if the Age limit is enabled
export const AGE_LIMIT = 14;
// Custom error codes handled by the client to show a specific error page
export const AGE_LIMIT_ERROR_CODE = 1001;
export const AUTHENTICATION_LOCKED_ERROR = 1002;
export const VALIDATION_COOKIE_ERROR_CODE = 1003;
export const DIFFERENT_USER_ACTIVE_SESSION_LOGIN_ERROR_CODE = 1004;

const validationCookieClearanceErrorInternal = (detail: string) =>
  withCookieClearanceResponseErrorInternal(
    detail,
    VALIDATION_COOKIE_NAME,
    VALIDATION_COOKIE_SETTINGS,
  );
const validationCookieClearancePermanentRedirect = (location: UrlFromString) =>
  withCookieClearanceResponsePermanentRedirect(
    location,
    VALIDATION_COOKIE_NAME,
    VALIDATION_COOKIE_SETTINGS,
  );
const validationCookieClearanceErrorValidation = (
  title: string,
  detail: string,
) =>
  withCookieClearanceResponseErrorValidation(
    title,
    detail,
    VALIDATION_COOKIE_NAME,
    VALIDATION_COOKIE_SETTINGS,
  );
const validationCookieClearanceErrorForbidden =
  withCookieClearanceResponseForbidden(
    VALIDATION_COOKIE_NAME,
    VALIDATION_COOKIE_SETTINGS,
  );

export type AcsDependencies = RedisRepo.RedisRepositoryDeps &
  FnAppAPIRepositoryDeps &
  LockUserAuthenticationDeps &
  FnLollipopRepo.LollipopApiDeps &
  RevokeAssertionRefDeps &
  CreateNewProfileDependencies &
  NotificationsRepo.NotificationsueueDeps &
  AppInsightsDeps &
  AuthSessionEventsRepo.AuthSessionEventsDeps & {
    getClientErrorRedirectionUrl: (
      params: ClientErrorRedirectionUrlParams,
    ) => UrlFromString;
    getClientProfileRedirectionUrl: (token: string) => UrlFromString;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    allowedCieTestFiscalCodes: ReadonlyArray<FiscalCode>;
    standardTokenDurationSecs: Second;
    lvTokenDurationSecs: Second;
    lvLongSessionDurationSecs: Second;
    isUserElegibleForIoLoginUrlScheme: ReturnType<
      typeof getIsUserElegibleForIoLoginUrlScheme
    >;
    isUserElegibleForFastLogin: (fiscalCode: FiscalCode) => boolean;
    isUserElegibleForValidationCookie: (fiscalCode: FiscalCode) => boolean;
  };

export const acs: (
  dependencies: AcsDependencies,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
) => AssertionConsumerServiceT<any> =
  (deps) =>
  // eslint-disable-next-line max-lines-per-function, complexity
  async (userPayload: unknown, additionalProps?: AdditionalLoginPropsT) => {
    //
    // decode the SPID assertion into a SPID user
    //
    const errorOrSpidUser = validateSpidUser(userPayload);

    if (E.isLeft(errorOrSpidUser)) {
      log.error(
        "acs: error validating the SPID user [%O] [%s]",
        userPayload,
        errorOrSpidUser.left,
      );
      return validationCookieClearanceErrorValidation(
        "Bad request",
        errorOrSpidUser.left,
      );
    }

    const spidUser = errorOrSpidUser.right;

    const req = spidUser.getAcsOriginalRequest();
    // Retrieve user IP from request
    const errorOrUserIp = IPString.decode(req?.ip);

    if (E.isLeft(errorOrUserIp)) {
      return validationCookieClearanceErrorInternal("Error reading user IP");
    }
    const requestIp = errorOrUserIp.right;

    // Validates AdditionalLoginProps.currentUser if provided
    const currentUserValidationResult = validateCurrentUser(additionalProps);

    // validate currentUser in additional props (if provided)
    if (E.isLeft(currentUserValidationResult)) {
      log.error(
        "acs: error additionalProp.currentUser -> [%O]  => [%s]",
        additionalProps?.currentUser,
        currentUserValidationResult.left,
      );
      return validationCookieClearanceErrorValidation(
        "Bad request",
        currentUserValidationResult.left,
      );
    }

    const currentUserFiscalCodeOption = currentUserValidationResult.right;

    if (
      isDifferentUserTryingToLogin(
        spidUser.fiscalNumber,
        currentUserFiscalCodeOption,
      )
    ) {
      // In Case of provided currentUser, we check if it match the spidUser.fiscalNumber in SAMLResponse
      // In case not we will block the login cause a different user is attempting an "active session login"
      const redirectionUrl = deps.getClientErrorRedirectionUrl({
        errorCode: DIFFERENT_USER_ACTIVE_SESSION_LOGIN_ERROR_CODE,
      });

      deps.appInsightsTelemetryClient?.trackEvent({
        name: "acs.error.different_user_active_session_login",
        properties: {
          message:
            "User login blocked due to a mismatch on FiscalCode between SAMLResponse and currentUser header",
          spidFiscalNumberSha256: sha256(spidUser.fiscalNumber),
          currentUser: additionalProps?.currentUser,
        },
        tagOverrides: {
          samplingEnabled: "false",
        },
      });

      const rejectedLoginEvent: RejectedLoginEvent = {
        ...buildBaseRejectedLoginEvent(spidUser, requestIp),
        rejectionCause: RejectedLoginCauseEnum.CF_MISMATCH,
        currentFiscalCodeHash: currentUserFiscalCodeOption.value,
      };

      // emit event for Audit Logs (Failsafe in case of error emit custom event) fire and forget
      await emitRejectedLoginEventWithTelemetry(rejectedLoginEvent)(deps)();

      return pipe(
        deps.isUserElegibleForIoLoginUrlScheme(spidUser.fiscalNumber),
        B.fold(
          () =>
            E.right(validationCookieClearancePermanentRedirect(redirectionUrl)),
          () => internalErrorOrIoLoginRedirect(redirectionUrl),
        ),
        E.toUnion,
      );
    }

    // if the CIE test user is not in the whitelist we return
    // with a not authorized
    if (
      isCIETestEnvLogin(spidUser.issuer) &&
      !getIsUserElegibleForCIETestEnv(deps.allowedCieTestFiscalCodes)(
        spidUser.fiscalNumber,
      )
    ) {
      log.warn(
        `unallowed CF tried to login on CIE TEST IDP, issuer: [%s]`,
        spidUser.issuer,
      );
      return validationCookieClearanceErrorForbidden;
    }

    if (!isOlderThan(AGE_LIMIT)(parse(spidUser.dateOfBirth), new Date())) {
      // The IO App show the proper error screen if only the `errorCode`
      // query param is provided and `errorMessage` is missing.
      // this constraint could be ignored when this PR https://github.com/pagopa/io-app/pull/3642 is merged,
      // released in a certain app version and that version become the minimum version supported.
      const redirectionUrl = deps.getClientErrorRedirectionUrl({
        errorCode: AGE_LIMIT_ERROR_CODE,
      });
      log.error(
        `acs: the age of the user is less than ${AGE_LIMIT} yo [%s]`,
        spidUser.dateOfBirth,
      );
      deps.appInsightsTelemetryClient?.trackEvent({
        name: "spid.error.generic",
        properties: {
          message: "User login blocked for reached age limits",
          type: "INFO",
        },
      });

      const rejectedLoginEvent: RejectedLoginEvent = {
        ...buildBaseRejectedLoginEvent(spidUser, requestIp),
        rejectionCause: RejectedLoginCauseEnum.AGE_BLOCK,
        minimumAge: AGE_LIMIT,
        dateOfBirth: spidUser.dateOfBirth,
      };

      // emit event for Audit Logs (Failsafe in case of error emit custom event) fire and forget
      await emitRejectedLoginEventWithTelemetry(rejectedLoginEvent)(deps)();

      return pipe(
        deps.isUserElegibleForIoLoginUrlScheme(spidUser.fiscalNumber),
        B.fold(
          () =>
            E.right(validationCookieClearancePermanentRedirect(redirectionUrl)),
          () => internalErrorOrIoLoginRedirect(redirectionUrl),
        ),
        E.toUnion,
      );
    }

    const isUserElegibleForFastLoginResult = deps.isUserElegibleForFastLogin(
      spidUser.fiscalNumber,
    );
    // LV functionality is enable only if Lollipop is enabled.
    // With FF set to BETA or CANARY, only whitelisted CF can use the LV functionality (the token TTL is reduced if login type is `LV`).
    // With FF set to ALL all the user can use the LV (the token TTL is reduced if login type is `LV`).
    // Otherwise LV is disabled.
    const loginType = getLoginTypeOnElegible(
      additionalProps?.loginType,
      isUserElegibleForFastLoginResult,
    );
    const [sessionTTL, lollipopKeyTTL] =
      loginType === LoginTypeEnum.LV
        ? [deps.lvTokenDurationSecs, deps.lvLongSessionDurationSecs]
        : [deps.standardTokenDurationSecs, deps.standardTokenDurationSecs];

    const userSessionExpiration = addSeconds(new Date(), lollipopKeyTTL);

    //
    // create a new user object
    //

    // note: since we have a bunch of async operations that don't depend on
    //       each other, we can run them in parallel
    const [
      errorOrIsBlockedUser,
      errorOrIsUserProfileLocked,
      sessionToken,
      walletToken,
      myPortalToken,
      bpdToken,
      zendeskToken,
      fimsToken,
      sessionTrackingId,
    ] = await Promise.all([
      // ask the session storage whether this user is blocked
      RedisSessionStorageService.isBlockedUser({
        fiscalCode: spidUser.fiscalNumber,
        redisClientSelector: deps.redisClientSelector,
      })(),
      // ask the profile service whether this user profile has been locked from IO-WEB by the user.
      // NOTE: login with SpidL3 are always allowed
      isSpidL3(spidUser.authnContextClassRef)
        ? E.of(false)
        : AuthenticationLockService.isUserAuthenticationLocked(
            spidUser.fiscalNumber,
          )(deps)(),
      // authentication token for app backend
      TokenService.getNewTokenAsync(SESSION_TOKEN_LENGTH_BYTES),
      // authentication token for pagoPA
      TokenService.getNewTokenAsync(SESSION_TOKEN_LENGTH_BYTES),
      // authentication token for MyPortal
      TokenService.getNewTokenAsync(SESSION_TOKEN_LENGTH_BYTES),
      // authentication token for BPD
      TokenService.getNewTokenAsync(SESSION_TOKEN_LENGTH_BYTES),
      // authentication token for Zendesk
      TokenService.getNewTokenAsync(SESSION_TOKEN_LENGTH_BYTES),
      // authentication token for FIMS
      TokenService.getNewTokenAsync(SESSION_TOKEN_LENGTH_BYTES),
      // unique ID for tracking the user session
      TokenService.getNewTokenAsync(SESSION_ID_LENGTH_BYTES),
    ]);

    if (E.isLeft(errorOrIsBlockedUser)) {
      // the query to the session store failed
      const err = errorOrIsBlockedUser.left;
      log.error(`acs: error checking blocked user [${err.message}]`);
      return validationCookieClearanceErrorInternal(
        "Error while validating user",
      );
    }

    const isBlockedUser = errorOrIsBlockedUser.right;
    if (isBlockedUser) {
      const rejectedLoginEvent: RejectedLoginEvent = {
        ...buildBaseRejectedLoginEvent(spidUser, requestIp),
        rejectionCause: RejectedLoginCauseEnum.ONGOING_USER_DELETION,
      };

      // emit event for Audit Logs (Failsafe in case of error emit custom event) fire and forget
      await emitRejectedLoginEventWithTelemetry(rejectedLoginEvent)(deps)();

      return validationCookieClearanceErrorForbidden;
    }

    if (isUserElegibleForFastLoginResult) {
      if (E.isLeft(errorOrIsUserProfileLocked)) {
        const err = errorOrIsUserProfileLocked.left;
        log.error(`acs: error checking user profile lock [${err.message}]`);
        return validationCookieClearanceErrorInternal(
          "An error occurred during user verification.",
        );
      }
      const isUserProfileLocked = errorOrIsUserProfileLocked.right;
      if (isUserProfileLocked) {
        const redirectionUrl = deps.getClientErrorRedirectionUrl({
          errorCode: AUTHENTICATION_LOCKED_ERROR,
        });
        log.error(
          `acs: ${sha256(spidUser.fiscalNumber)} - The user profile is locked.`,
        );

        const rejectedLoginEvent: RejectedLoginEvent = {
          ...buildBaseRejectedLoginEvent(spidUser, requestIp),
          rejectionCause: RejectedLoginCauseEnum.AUTH_LOCK,
        };

        // emit event for Audit Logs (Failsafe in case of error emit custom event) fire and forget
        await emitRejectedLoginEventWithTelemetry(rejectedLoginEvent)(deps)();

        return pipe(
          deps.isUserElegibleForIoLoginUrlScheme(spidUser.fiscalNumber),
          B.fold(
            () =>
              E.right(
                validationCookieClearancePermanentRedirect(redirectionUrl),
              ),
            () => internalErrorOrIoLoginRedirect(redirectionUrl),
          ),
          E.toUnion,
        );
      }
    }

    const user = toAppUser(
      spidUser,
      sessionToken as SessionToken,
      walletToken as WalletToken,
      myPortalToken as MyPortalToken,
      bpdToken as BPDToken,
      zendeskToken as ZendeskToken,
      fimsToken as FIMSToken,
      sessionTrackingId,
    );

    const errorOrMaybeAssertionRef =
      await RedisSessionStorageService.getLollipopAssertionRefForUser({
        fiscalCode: user.fiscal_code,
        redisClientSelector: deps.redisClientSelector,
      })();

    const lollipopErrorEventName = "lollipop.error.acs";

    if (E.isLeft(errorOrMaybeAssertionRef)) {
      deps.appInsightsTelemetryClient?.trackEvent({
        name: lollipopErrorEventName,
        properties: {
          fiscal_code: sha256(user.fiscal_code),
          message: "Error retrieving previous lollipop configuration",
        },
      });
      return validationCookieClearanceErrorInternal(
        "Error retrieving previous lollipop configuration",
      );
    }

    // TODO: simplify the following lines using the method `deleteAssertionRefAssociation`
    if (O.isSome(errorOrMaybeAssertionRef.right)) {
      const assertionRefToRevoke = errorOrMaybeAssertionRef.right.value;
      // Sending a revoke message for previous assertionRef related to the same fiscalCode
      // This operation is fire and forget
      pipe(
        LollipopRevokeRepo.revokePreviousAssertionRef(assertionRefToRevoke)(
          deps,
        ),
        TE.mapLeft((err) => {
          deps.appInsightsTelemetryClient?.trackEvent({
            name: lollipopErrorEventName,
            properties: {
              assertion_ref: assertionRefToRevoke,
              error: err,
              fiscal_code: sha256(user.fiscal_code),
              message:
                "acs: error sending revoke message for previous assertionRef",
            },
          });
          log.error(
            "acs: error sending revoke message for previous assertionRef [%s]",
            err,
          );
        }),
      )().catch(() => void 0 as never);
    }

    const errorOrActivatedPubKey = await pipe(
      // Delete the reference to CF and assertionRef for lollipop.
      // This operation must be performed even if the lollipop FF is disabled
      // to avoid inconsistency on CF-key relation if the FF will be re-enabled.
      RedisSessionStorageService.delLollipopDataForUser({
        redisClientSelector: deps.redisClientSelector,
        fiscalCode: spidUser.fiscalNumber,
      }),
      TE.filterOrElse(
        (delLollipopAssertionRefResult) =>
          delLollipopAssertionRefResult === true,
        () => new Error("Error on LolliPoP initialization"),
      ),
      TE.mapLeft((error) => {
        deps.appInsightsTelemetryClient?.trackEvent({
          name: lollipopErrorEventName,
          properties: {
            fiscal_code: sha256(user.fiscal_code),
            message: `acs: ${error.message}`,
          },
        });
        return O.some(validationCookieClearanceErrorInternal(error.message));
      }),
      TE.chainW(() =>
        pipe(
          safeXMLParseFromString(spidUser.getSamlResponseXml()),
          TE.fromOption(() =>
            O.some(
              validationCookieClearanceErrorInternal(
                "Unexpected parsing error SAML Response",
              ),
            ),
          ),
          TE.map(getRequestIDFromResponse),
        ),
      ),
      TE.chainW(
        flow(
          O.chainEitherK(AssertionRef.decode),
          TE.fromOption(() => O.none),
        ),
      ),
      TE.chainW((assertionRef) =>
        pipe(
          {
            isUserElegible: deps.isUserElegibleForValidationCookie(
              spidUser.fiscalNumber,
            ),
            // even if the FF is off, we want to send an event if a mismatch
            // happens. so this either is evaluated in each case
            errorOrValidatedCookie: pipe(
              req.cookies,
              RR.lookup(VALIDATION_COOKIE_NAME),
              E.fromOption(() => {
                deps.appInsightsTelemetryClient?.trackEvent({
                  name: "acs.error.validation_cookie_missing",
                  properties: {
                    assertionRef,
                    fiscal_code: sha256(spidUser.fiscalNumber),
                    issuer: spidUser.issuer,
                  },
                  tagOverrides: {
                    samplingEnabled: "false",
                  },
                });
                return Error("Validation cookie missing");
              }),
              E.chain(
                E.fromPredicate(
                  (cookieValue) => assertionRef === cookieValue,
                  (cookieValue) => {
                    deps.appInsightsTelemetryClient?.trackEvent({
                      name: "acs.error.validation_cookie_mismatch",
                      properties: {
                        assertionRef,
                        fiscal_code: sha256(spidUser.fiscalNumber),
                        issuer: spidUser.issuer,
                        received_cookie: cookieValue,
                      },
                      tagOverrides: {
                        samplingEnabled: "false",
                      },
                    });
                    return Error("Validation step for cookie failed");
                  },
                ),
              ),
              E.map(() => void 0),
            ),
          },
          ({ isUserElegible, errorOrValidatedCookie }) =>
            pipe(
              isUserElegible,
              B.fold(
                () => E.right(assertionRef),
                () =>
                  pipe(
                    errorOrValidatedCookie,
                    E.mapLeft(() =>
                      // if user is elegible for cookie validation
                      // and cookie is either missing or invalid we return
                      // a custom error to the client
                      O.some(
                        validationCookieClearancePermanentRedirect(
                          getClientErrorRedirectionUrl({
                            errorMessage: "Validation error" as NonEmptyString,
                            errorCode: VALIDATION_COOKIE_ERROR_CODE,
                          }),
                        ),
                      ),
                    ),
                    // proceed as usual
                    E.map((_) => assertionRef),
                  ),
              ),
            ),
          TE.fromEither,
        ),
      ),
      TE.chainW((assertionRef) =>
        pipe(
          LollipopService.activateLolliPoPKey({
            assertionRef,
            fiscalCode: user.fiscal_code,
            assertion: spidUser.getSamlResponseXml(),
            getExpirePubKeyFn: () => userSessionExpiration,
            appInsightsTelemetryClient: deps.appInsightsTelemetryClient,
            fnLollipopAPIClient: deps.fnLollipopAPIClient,
          }),
          TE.chainFirst(() =>
            pipe(
              isUserElegibleForFastLoginResult,
              B.fold(
                () =>
                  RedisSessionStorageService.setLollipopAssertionRefForUser(
                    user,
                    assertionRef,
                    lollipopKeyTTL,
                  )({ redisClientSelector: deps.redisClientSelector }),
                () =>
                  RedisSessionStorageService.setLollipopDataForUser(
                    user,
                    { assertionRef, loginType },
                    lollipopKeyTTL,
                  )({ redisClientSelector: deps.redisClientSelector }),
              ),
              TE.filterOrElse(
                (setLollipopDataForUserRes) =>
                  setLollipopDataForUserRes === true,
                () =>
                  new Error(
                    "Error creating CF - assertion ref relation in redis",
                  ),
              ),
              TE.mapLeft((error) => {
                deps.appInsightsTelemetryClient?.trackEvent({
                  name: lollipopErrorEventName,
                  properties: {
                    assertion_ref: assertionRef,
                    fiscal_code: sha256(user.fiscal_code),
                    message: error.message,
                  },
                });
                return error;
              }),
            ),
          ),
          TE.mapLeft(() =>
            O.some(
              validationCookieClearanceErrorInternal(
                "Error Activation Lollipop Key",
              ),
            ),
          ),
        ),
      ),
    )();
    if (
      E.isLeft(errorOrActivatedPubKey) &&
      O.isSome<IResponseErrorInternal | IResponsePermanentRedirect>(
        errorOrActivatedPubKey.left,
      )
    ) {
      return errorOrActivatedPubKey.left.value;
    }

    // Attempt to create a new session object while we fetch an existing profile
    // for the user
    const [errorOrIsSessionCreated, errorOrGetProfileResponse] =
      await Promise.all([
        RedisSessionStorageService.set(
          deps.redisClientSelector,
          sessionTTL,
        )(user)(),
        ProfileService.getProfile({
          user,
          fnAppAPIClient: deps.fnAppAPIClient,
        })(),
      ]);

    if (E.isLeft(errorOrIsSessionCreated)) {
      const error = errorOrIsSessionCreated.left;
      log.error(
        `acs: error while creating the user session [${error.message}]`,
      );
      return validationCookieClearanceErrorInternal(
        "Error while creating the user session",
      );
    }

    const isSessionCreated = errorOrIsSessionCreated.right;

    if (E.isLeft(errorOrGetProfileResponse)) {
      const error = errorOrGetProfileResponse.left;
      log.error(
        `acs: error while creating the user session [${error.message}]`,
      );
      return validationCookieClearanceErrorInternal(
        "Error while creating the user session",
      );
    }

    const getProfileResponse = errorOrGetProfileResponse.right;

    if (isSessionCreated === false) {
      log.error("Error creating the user session");
      return validationCookieClearanceErrorInternal(
        "Error creating the user session",
      );
    }

    let userEmail: EmailString | undefined;
    let userHasEmailValidated: boolean | undefined;
    let loginScenario: LoginScenarioEnum | undefined;

    if (getProfileResponse.kind === "IResponseErrorNotFound") {
      // a profile for the user does not yet exist, we attempt to create a new
      // one
      loginScenario = LoginScenarioEnum.NEW_USER;

      const errorOrCreateProfileResponse = await ProfileService.createProfile(
        user,
        spidUser,
      )(deps)();

      if (
        E.isLeft(errorOrCreateProfileResponse) ||
        errorOrCreateProfileResponse.right.kind !== "IResponseSuccessJson"
      ) {
        log.error(
          "Error creating new user's profile: %s",
          E.isRight(errorOrCreateProfileResponse)
            ? errorOrCreateProfileResponse.right.detail
            : errorOrCreateProfileResponse,
        );
        // we switch to a generic error since the acs definition
        // in io-spid-commons does not support 429 / 409 errors
        return validationCookieClearanceErrorInternal(
          "Error creating a new User Profile",
        );
      }
      userHasEmailValidated =
        errorOrCreateProfileResponse.right.value.is_email_validated;
      userEmail = user.spid_email;
    } else if (getProfileResponse.kind !== "IResponseSuccessJson") {
      // errorOrActivatedPubKey is Left when login was not a lollipop login
      if (E.isRight(errorOrActivatedPubKey)) {
        await LollipopService.deleteAssertionRefAssociation(
          user.fiscal_code,
          errorOrActivatedPubKey.right.assertion_ref,
          lollipopErrorEventName,
          "acs: error deleting lollipop data while fallbacking from getProfile response error",
        )(deps)();
      }
      log.error(
        "Error retrieving user's profile: %s",
        getProfileResponse.detail,
      );
      // we switch to a generic error since the acs definition
      // in io-spid-commons does not support 429 errors
      return validationCookieClearanceErrorInternal(getProfileResponse.kind);
    } else {
      // If additionalProps?.currentUser is found we are in a relogin scenario
      loginScenario = additionalProps?.currentUser
        ? LoginScenarioEnum.RELOGIN
        : LoginScenarioEnum.STANDARD;
      userHasEmailValidated = getProfileResponse.value.is_email_validated;
      userEmail =
        userHasEmailValidated && getProfileResponse.value.email
          ? getProfileResponse.value.email
          : user.spid_email;
    }

    // async fire & forget
    pipe(
      NotificationsRepo.deleteInstallation(user.fiscal_code)(deps),
      TE.map((response) => {
        if (response.errorCode) {
          log.debug(
            "The submit of the delete installation message return an error: %s",
            response.errorCode,
          );
        }
      }),
      TE.mapLeft((err) => {
        log.error(
          "Cannot delete Notification Installation: %s",
          JSON.stringify(err),
        );
      }),
    )().catch(() => void 0);

    if (userEmail) {
      const errorOrNotifyLoginResult = await pipe(
        {
          email: userEmail,
          family_name: user.family_name,
          fiscal_code: user.fiscal_code,
          identity_provider: pipe(
            Issuer.decode(spidUser.issuer),
            E.map((issuer) => IDP_NAMES[issuer]),
            E.chainW(E.fromNullable(null)),
            E.getOrElse(() => "Sconosciuto"),
          ),
          ip_address: requestIp,
          is_email_validated: userHasEmailValidated,
          name: user.name,
        },
        UserLoginParams.decode,
        TE.fromEither,
        TE.mapLeft((err) => {
          {
            log.error(
              "Cannot decode UserLoginParams",
              readableReportSimplified(err),
            );
            return readableReportSimplified(err);
          }
        }),
        TE.chainW(
          flow(
            (loginData) => LoginService.onUserLogin(loginData)(deps),
            TE.mapLeft((err) => {
              {
                log.error(`Unable to notify user login event | ${err.message}`);
                return err.message;
              }
            }),
          ),
        ),
        TE.mapLeft((err) => {
          deps.appInsightsTelemetryClient?.trackEvent({
            name: lollipopErrorEventName + ".notify",
            properties: {
              error: err,
              fiscal_code: sha256(user.fiscal_code),
              message: "acs: Unable to notify user login event",
            },
          });

          return validationCookieClearanceErrorInternal(
            "Unable to notify user login event",
          );
        }),
      )();

      if (E.isLeft(errorOrNotifyLoginResult)) {
        // errorOrActivatedPubKey is Left when login was not a lollipop login
        if (E.isRight(errorOrActivatedPubKey)) {
          await LollipopService.deleteAssertionRefAssociation(
            user.fiscal_code,
            errorOrActivatedPubKey.right.assertion_ref,
            lollipopErrorEventName,
            "acs: error deleting lollipop data while fallbacking from notify login failure",
          )(deps)();
        }

        return errorOrNotifyLoginResult.left;
      }
    }

    const urlWithToken = deps.getClientProfileRedirectionUrl(
      user.session_token,
    );

    const event: LoginEvent = {
      eventType: EventTypeEnum.LOGIN,
      fiscalCode: spidUser.fiscalNumber,
      scenario: loginScenario,
      loginType:
        loginType === LoginTypeEnum.LV
          ? ServiceBusLoginTypeEnum.LV
          : ServiceBusLoginTypeEnum.LEGACY,
      idp: spidUser.issuer,
      ts: new Date(),
      expiredAt: userSessionExpiration,
    };

    const errorOrEventEmitted = await pipe(
      AuthSessionEventsRepo.emitAuthSessionEvent(event)(deps),
      TE.mapLeft((err) =>
        validationCookieClearanceErrorInternal(
          `Unable to emit login event: ${err.message}`,
        ),
      ),
    )();

    if (E.isLeft(errorOrEventEmitted)) {
      return errorOrEventEmitted.left;
    }

    return pipe(
      deps.isUserElegibleForIoLoginUrlScheme(user.fiscal_code),
      B.fold(
        () => E.right(validationCookieClearancePermanentRedirect(urlWithToken)),
        () => internalErrorOrIoLoginRedirect(urlWithToken),
      ),
      E.toUnion,
    );
  };

const isDifferentUserTryingToLogin = (
  spidUserFiscalCode: FiscalCode,
  currentUserFiscalCodeOption: O.Option<string>,
): currentUserFiscalCodeOption is O.Some<string> =>
  O.isSome(currentUserFiscalCodeOption) &&
  currentUserFiscalCodeOption.value !== sha256(spidUserFiscalCode);

// If not provided currentUser is valid
const validateCurrentUser = (
  additionalProps?: AdditionalLoginPropsT,
): E.Either<string, O.Option<Sha256HexString>> => {
  if (!additionalProps?.currentUser) {
    return E.right(O.none);
  }

  return pipe(
    additionalProps.currentUser,
    Sha256HexString.decode,
    E.mapLeft(
      (errs) =>
        `Invalid currentUser: not a valid sha256HexString (${errorsToReadableMessages(errs).join(" / ")})`,
    ),
    E.map(O.some),
  );
};

const extractLoginIdFromResponse = (
  spidUser: SpidUser,
): O.Option<NonEmptyString> =>
  pipe(
    spidUser.getSamlResponseXml(),
    safeXMLParseFromString,
    O.chain(getRequestIDFromResponse),
    O.chainEitherK(NonEmptyString.decode),
  );

export const buildBaseRejectedLoginEvent = (
  spidUser: SpidUser,
  requestIp: IPString,
): BaseRejectedLoginEventContent => ({
  eventType: EventTypeEnum.REJECTED_LOGIN,
  fiscalCode: spidUser.fiscalNumber,
  ts: new Date(),
  ip: requestIp,
  loginId: O.toUndefined(extractLoginIdFromResponse(spidUser)),
});

// emit event on RejectionLogin
// on Faliure write a customEvent
const emitRejectedLoginEventWithTelemetry =
  (event: RejectedLoginEvent): RT.ReaderTask<AcsDependencies, void> =>
  (deps) =>
    pipe(
      AuthSessionEventsRepo.emitAuthSessionEvent(event)(deps),
      TE.getOrElseW((err) => {
        deps.appInsightsTelemetryClient?.trackEvent({
          name: "acs.error.rejected_login_event.emit_failed",
          properties: {
            message: err.message,
            stack: err.stack ?? "",
            ...event,
          },
          tagOverrides: { samplingEnabled: "false" },
        });
        return T.of(void 0);
      }),
    );

export const acsTest: (
  userPayload: unknown,
) => (
  dependencies: AcsDependencies,
) => TE.TaskEither<
  Error,
  | IResponseErrorInternal
  | IResponseErrorValidation
  | IResponseErrorForbiddenNotAuthorized
  | IResponseSuccessJson<AccessToken>
> = (userPayload) => (deps) =>
  TE.tryCatch(async () => {
    // Use the imported acs to handle the spyOn on unit tests.
    const acsResponse = await AuthenticationController.acs(deps)(
      userPayload,
      pipe(
        validateSpidUser(userPayload),
        E.chainW((spidUser) =>
          acsRequestMapper(spidUser.getAcsOriginalRequest()),
        ),
        E.getOrElseW(() => ({})),
      ),
    );
    // When the login succeeded with a ResponsePermanentRedirect (301)
    // the token was extract from the response and returned into the body
    // of a ResponseSuccessJson (200)
    // Ref: https://www.pivotaltracker.com/story/show/173847889
    if (acsResponse.kind === "IResponsePermanentRedirect") {
      return pipe(
        acsResponse.detail,
        E.fromNullable(
          new Error("Missing detail in ResponsePermanentRedirect"),
        ),
        E.chain((url) =>
          pipe(
            url.split("token="),
            E.fromPredicate(
              (arr) => arr.length > 1,
              () => new Error("Unexpected redirection url"),
            ),
            E.map((arr) => arr.pop()),
            E.chain(E.fromNullable(new Error("Unexpected redirection url"))),
          ),
        ),
        E.chain((token) =>
          pipe(
            token,
            NonEmptyString.decode,
            E.mapLeft(
              (err) =>
                new Error(`Decode Error: [${errorsToReadableMessages(err)}]`),
            ),
          ),
        ),
        E.map((token) => ResponseSuccessJson({ token })),
        E.mapLeft((err) => validationCookieClearanceErrorInternal(err.message)),
        E.toUnion,
      );
    }
    return acsResponse;
  }, E.toError);
