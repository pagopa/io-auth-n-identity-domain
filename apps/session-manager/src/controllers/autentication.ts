/* eslint-disable max-lines-per-function */
import { UrlFromString } from "@pagopa/ts-commons/lib/url";
import {
  ResponseErrorForbiddenNotAuthorized,
  ResponseErrorInternal,
  ResponseErrorValidation,
  ResponsePermanentRedirect,
} from "@pagopa/ts-commons/lib/responses";
import { AssertionConsumerServiceT } from "@pagopa/io-spid-commons";
import * as E from "fp-ts/Either";
import {
  EmailString,
  FiscalCode,
  IPString,
} from "@pagopa/ts-commons/lib/strings";
import { flow, pipe } from "fp-ts/lib/function";
import * as B from "fp-ts/lib/boolean";
import * as O from "fp-ts/Option";
import { addSeconds, parse } from "date-fns";
import { Second } from "@pagopa/ts-commons/lib/units";
import { sha256 } from "@pagopa/io-functions-commons/dist/src/utils/crypto";
import * as TE from "fp-ts/TaskEither";
import { safeXMLParseFromString } from "@pagopa/io-spid-commons/dist/utils/samlUtils";
import * as AP from "fp-ts/lib/Apply";
import { IDP_NAMES, Issuer } from "@pagopa/io-spid-commons/dist/config";
import { UserLoginParams } from "@pagopa/io-functions-app-sdk/UserLoginParams";
import { readableReportSimplified } from "@pagopa/ts-commons/lib/reporters";
import {
  LoginUserEventRepo,
  FnLollipopRepo,
  LollipopRevokeRepo,
  NotificationsRepo,
  RedisRepo,
} from "../repositories";
import { ClientErrorRedirectionUrlParams } from "../config/spid";
import { FnAppAPIRepositoryDeps } from "../repositories/fn-app-api";
import { AdditionalLoginPropsT, LoginTypeEnum } from "../types/fast-login";
import { toAppUser, validateSpidUser } from "../utils/user";
import { log } from "../utils/logger";
import {
  getIsUserElegibleForCIETestEnv,
  isCIETestEnvLogin,
} from "../utils/cie";
import { isOlderThan } from "../utils/date";
import {
  getIsUserElegibleForIoLoginUrlScheme,
  internalErrorOrIoLoginRedirect,
} from "../utils/login-uri-scheme";
import { isUserElegibleForFastLogin } from "../config/fast-login";
import { getLoginTypeOnElegible } from "../utils/fast-login";
import {
  AuthenticationLockService,
  LoginService,
  LollipopService,
  ProfileService,
  RedisSessionStorageService,
  TokenService,
} from "../services";
import { isSpidL3 } from "../types/spid";
import {
  BPDToken,
  FIMSToken,
  MyPortalToken,
  SessionToken,
  WalletToken,
  ZendeskToken,
} from "../types/token";
import { LockUserAuthenticationDeps } from "../repositories/locked-profiles";
import { RevokeAssertionRefDeps } from "../repositories/lollipop-revoke-queue";
import { getRequestIDFromResponse } from "../utils/spid";
import { AssertionRef } from "../generated/backend/AssertionRef";
import { CreateNewProfileDependencies } from "../services/profile";
import { SESSION_ID_LENGTH_BYTES, SESSION_TOKEN_LENGTH_BYTES } from "./session";

// Minimum user age allowed to login if the Age limit is enabled
export const AGE_LIMIT = 14;
// Custom error codes handled by the client to show a specific error page
export const AGE_LIMIT_ERROR_CODE = 1001;
export const AUTHENTICATION_LOCKED_ERROR = 1002;

type AcsDependencies = RedisRepo.RedisRepositoryDeps &
  FnAppAPIRepositoryDeps &
  LockUserAuthenticationDeps &
  LoginUserEventRepo.LoginUserEventDeps &
  FnLollipopRepo.LollipopApiDeps &
  RevokeAssertionRefDeps &
  CreateNewProfileDependencies &
  NotificationsRepo.NotificationsueueDeps & {
    isLollipopEnabled: boolean;
    getClientErrorRedirectionUrl: (
      params: ClientErrorRedirectionUrlParams,
    ) => UrlFromString;
    getClientProfileRedirectionUrl: (token: string) => UrlFromString;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    appInsightsTelemetryClient?: any;
    allowedCieTestFiscalCodes: ReadonlyArray<FiscalCode>;
    hasUserAgeLimitEnabled: boolean;
    standardTokenDurationSecs: Second;
    lvTokenDurationSecs: Second;
    lvLongSessionDurationSecs: Second;
    isUserElegibleForIoLoginUrlScheme: ReturnType<
      typeof getIsUserElegibleForIoLoginUrlScheme
    >;
  };

export const acs: (
  dependencies: AcsDependencies,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
) => AssertionConsumerServiceT<any> =
  (deps) =>
  // eslint-disable-next-line max-lines-per-function, complexity, sonarjs/cognitive-complexity
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
      return ResponseErrorValidation("Bad request", errorOrSpidUser.left);
    }

    const spidUser = errorOrSpidUser.right;

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
      return ResponseErrorForbiddenNotAuthorized;
    }

    if (
      deps.hasUserAgeLimitEnabled &&
      !isOlderThan(AGE_LIMIT)(parse(spidUser.dateOfBirth), new Date())
    ) {
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

      return pipe(
        deps.isUserElegibleForIoLoginUrlScheme(spidUser.fiscalNumber),
        B.fold(
          () => E.right(ResponsePermanentRedirect(redirectionUrl)),
          () => internalErrorOrIoLoginRedirect(redirectionUrl),
        ),
        E.toUnion,
      );
    }

    const isUserElegibleForFastLoginResult = isUserElegibleForFastLogin(
      spidUser.fiscalNumber,
    );
    // LV functionality is enable only if Lollipop is enabled.
    // With FF set to BETA or CANARY, only whitelisted CF can use the LV functionality (the token TTL is reduced if login type is `LV`).
    // With FF set to ALL all the user can use the LV (the token TTL is reduced if login type is `LV`).
    // Otherwise LV is disabled.
    const loginType = getLoginTypeOnElegible(
      additionalProps?.loginType,
      isUserElegibleForFastLoginResult,
      deps.isLollipopEnabled,
    );
    const [sessionTTL, lollipopKeyTTL] =
      loginType === LoginTypeEnum.LV
        ? [deps.lvTokenDurationSecs, deps.lvLongSessionDurationSecs]
        : [deps.standardTokenDurationSecs, deps.standardTokenDurationSecs];

    // Retrieve user IP from request
    const errorOrUserIp = IPString.decode(spidUser.getAcsOriginalRequest()?.ip);

    if (isUserElegibleForFastLoginResult && E.isLeft(errorOrUserIp)) {
      return ResponseErrorInternal("Error reading user IP");
    }

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
      return ResponseErrorInternal("Error while validating user");
    }

    const isBlockedUser = errorOrIsBlockedUser.right;
    if (isBlockedUser) {
      return ResponseErrorForbiddenNotAuthorized;
    }

    if (isUserElegibleForFastLoginResult) {
      if (E.isLeft(errorOrIsUserProfileLocked)) {
        const err = errorOrIsUserProfileLocked.left;
        log.error(`acs: error checking user profile lock [${err.message}]`);
        return ResponseErrorInternal(
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
        return pipe(
          deps.isUserElegibleForIoLoginUrlScheme(spidUser.fiscalNumber),
          B.fold(
            () => E.right(ResponsePermanentRedirect(redirectionUrl)),
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

    const errorOrMaybeAssertionRef = deps.isLollipopEnabled
      ? await RedisSessionStorageService.getLollipopAssertionRefForUser({
          fiscalCode: user.fiscal_code,
          redisClientSelector: deps.redisClientSelector,
        })()
      : E.right(O.none);

    const lollipopErrorEventName = "lollipop.error.acs";

    if (E.isLeft(errorOrMaybeAssertionRef)) {
      deps.appInsightsTelemetryClient?.trackEvent({
        name: lollipopErrorEventName,
        properties: {
          fiscal_code: sha256(user.fiscal_code),
          message: "Error retrieving previous lollipop configuration",
        },
      });
      return ResponseErrorInternal(
        "Error retrieving previous lollipop configuration",
      );
    }

    if (deps.isLollipopEnabled && O.isSome(errorOrMaybeAssertionRef.right)) {
      const assertionRefToRevoke = errorOrMaybeAssertionRef.right.value;
      // Sending a revoke message for previous assertionRef related to the same fiscalCode
      // This operation is fire and forget
      LollipopRevokeRepo.revokePreviousAssertionRef(assertionRefToRevoke)(
        deps,
      )().catch((err) => {
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
      });
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
        return O.some(ResponseErrorInternal(error.message));
      }),
      TE.chainW(() =>
        pipe(
          safeXMLParseFromString(spidUser.getSamlResponseXml()),
          TE.fromOption(() =>
            O.some(
              ResponseErrorInternal("Unexpected parsing error SAML Response"),
            ),
          ),
          TE.map(getRequestIDFromResponse),
        ),
      ),
      TE.chainW(
        flow(
          O.chain(O.fromPredicate(() => deps.isLollipopEnabled)),
          O.chainEitherK(AssertionRef.decode),
          TE.fromOption(() => O.none),
        ),
      ),
      TE.chainW((assertionRef) =>
        pipe(
          AP.sequenceT(TE.ApplicativeSeq)(
            LollipopService.activateLolliPoPKey({
              assertionRef,
              fiscalCode: user.fiscal_code,
              assertion: spidUser.getSamlResponseXml(),
              getExpirePubKeyFn: () => addSeconds(new Date(), lollipopKeyTTL),
              appInsightsTelemetryClient: deps.appInsightsTelemetryClient,
              fnLollipopAPIClient: deps.fnLollipopAPIClient,
            }),
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
            O.some(ResponseErrorInternal("Error Activation Lollipop Key")),
          ),
        ),
      ),
    )();
    if (
      E.isLeft(errorOrActivatedPubKey) &&
      O.isSome(errorOrActivatedPubKey.left)
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
      return ResponseErrorInternal("Error while creating the user session");
    }

    const isSessionCreated = errorOrIsSessionCreated.right;

    if (E.isLeft(errorOrGetProfileResponse)) {
      const error = errorOrGetProfileResponse.left;
      log.error(
        `acs: error while creating the user session [${error.message}]`,
      );
      return ResponseErrorInternal("Error while creating the user session");
    }

    const getProfileResponse = errorOrGetProfileResponse.right;

    if (isSessionCreated === false) {
      log.error("Error creating the user session");
      return ResponseErrorInternal("Error creating the user session");
    }

    // eslint-disable-next-line functional/no-let
    let userEmail: EmailString | undefined;
    // eslint-disable-next-line functional/no-let
    let userHasEmailValidated: boolean | undefined;

    if (getProfileResponse.kind === "IResponseErrorNotFound") {
      // a profile for the user does not yet exist, we attempt to create a new
      // one

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
        return ResponseErrorInternal("Error creating a new User Profile");
      }
      userHasEmailValidated =
        errorOrCreateProfileResponse.right.value.is_email_validated;
      userEmail = user.spid_email;
    } else if (getProfileResponse.kind !== "IResponseSuccessJson") {
      // errorOrActivatedPubKey is Left when login was not a lollipop login
      if (E.isRight(errorOrActivatedPubKey)) {
        await LollipopService.deleteAssertionRefAssociation(
          user.fiscal_code,
          errorOrActivatedPubKey.right[0].assertion_ref,
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
      return ResponseErrorInternal(getProfileResponse.kind);
    } else {
      userHasEmailValidated = getProfileResponse.value.is_email_validated;
      userEmail =
        userHasEmailValidated && getProfileResponse.value.email
          ? getProfileResponse.value.email
          : user.spid_email;
    }

    // Notify the user login
    try {
      await LoginUserEventRepo.logUserLogin({
        fiscalCode: spidUser.fiscalNumber,
        lastLoginAt: new Date(),
        source: spidUser.email !== undefined ? "spid" : "cie",
      })(deps)();
    } catch (e) {
      // Fire & forget, so just print a debug message
      log.debug("Cannot notify userLogin: %s", E.toError(e).message);
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

    if (
      userEmail &&
      deps.isLollipopEnabled &&
      isUserElegibleForFastLoginResult
    ) {
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
          ip_address: pipe(
            errorOrUserIp,
            // we've already checked errorOrUserIp, this will never happen
            E.getOrElse(() => ""),
          ),
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

          return ResponseErrorInternal("Unable to notify user login event");
        }),
      )();

      if (E.isLeft(errorOrNotifyLoginResult)) {
        // errorOrActivatedPubKey is Left when login was not a lollipop login
        if (E.isRight(errorOrActivatedPubKey)) {
          await LollipopService.deleteAssertionRefAssociation(
            user.fiscal_code,
            errorOrActivatedPubKey.right[0].assertion_ref,
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

    return pipe(
      deps.isUserElegibleForIoLoginUrlScheme(user.fiscal_code),
      B.fold(
        () => E.right(ResponsePermanentRedirect(urlWithToken)),
        () => internalErrorOrIoLoginRedirect(urlWithToken),
      ),
      E.toUnion,
    );
  };
