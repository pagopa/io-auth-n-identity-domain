import * as appInsights from "applicationinsights";
import { FiscalCode, NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import * as passport from "passport";
import { Strategy } from "passport-local";
import {
  Issuer,
  SPID_IDP_IDENTIFIERS,
} from "@pagopa/io-spid-commons/dist/config";
import { flow, pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import * as E from "fp-ts/Either";
import * as jose from "jose";
import * as express from "express";
import { SpidLevelEnum } from "../generated/backend/SpidLevel";
import { log } from "../utils/logger";
import {
  getASAMLAssertion_saml2Namespace,
  getASAMLResponse_saml2Namespace,
} from "../__mocks__/spid.mocks";
import { LollipopApiClient } from "../repositories/lollipop-api";
import { LollipopLoginParams, lollipopLoginHandler } from "../utils/lollipop";
import { SpidUser } from "../types/user";
import { VALIDATION_COOKIE_NAME } from "../config/validation-cookie";

/**
 * Create a new Local Strategy with provided authorized fiscal code (user names)
 * and a fixed password. Returns unauthorized if validUsernameList does not contain
 * the fiscal code (user name) provided during login.
 */
export const localStrategy = (
  validUsernameList: ReadonlyArray<FiscalCode>,
  validPassword: string,
  lollipopApiClient: LollipopApiClient,
  appInsightsTelemetryClient?: appInsights.TelemetryClient,
): passport.Strategy =>
  new Strategy({ passReqToCallback: true }, (req, username, password, done) => {
    pipe(
      TE.of(
        FiscalCode.is(username) &&
          validUsernameList.includes(username) &&
          validPassword === password,
      ),
      TE.chain(
        TE.fromPredicate(
          (isValidAuth) => isValidAuth,
          () => new Error("Invalid credentials"),
        ),
      ),
      TE.chain(() =>
        TE.tryCatch(
          () =>
            lollipopLoginHandler(lollipopApiClient, appInsightsTelemetryClient)(
              req,
              // mock cookie setting function for test-login
              { cookie: () => void 0 } as unknown as express.Response,
            ),
          E.toError,
        ),
      ),
      TE.chain(
        flow(
          TE.fromPredicate(
            (_): _ is undefined | LollipopLoginParams =>
              LollipopLoginParams.is(_) || _ === undefined,
            () => new Error("Invalid lollipop parameters"),
          ),
          TE.chainW((_) =>
            pipe(
              TE.tryCatch(
                async () =>
                  (_ === undefined
                    ? "_aTestValueRequestId"
                    : `${_.algo}-${await jose.calculateJwkThumbprint(
                        _.jwk,
                        _.algo,
                      )}`) as NonEmptyString,
                E.toError,
              ),
            ),
          ),
        ),
      ),
      TE.map((inResponseTo) => {
        const spidUserData = {
          authnContextClassRef: SpidLevelEnum["https://www.spid.gov.it/SpidL2"],
          dateOfBirth: "2000-06-02",
          familyName: "Rossi",
          fiscalNumber: username as FiscalCode, // Verified in line 31
          issuer: Object.keys(SPID_IDP_IDENTIFIERS)[0] as Issuer,
          name: "Mario",
        };

        // Setting req.cookies for test-login endpoint
        // eslint-disable-next-line functional/immutable-data
        req.cookies = { [VALIDATION_COOKIE_NAME]: inResponseTo };

        return {
          ...spidUserData,
          // mock cookies to let validation pass
          getAcsOriginalRequest: () => req,
          getAssertionXml: () =>
            getASAMLAssertion_saml2Namespace(
              username as FiscalCode,
              inResponseTo,
              spidUserData.authnContextClassRef,
              spidUserData.name,
              spidUserData.familyName,
              spidUserData.dateOfBirth,
            ),
          getSamlResponseXml: () =>
            getASAMLResponse_saml2Namespace(
              username as FiscalCode,
              inResponseTo,
              spidUserData.authnContextClassRef,
              spidUserData.name,
              spidUserData.familyName,
              spidUserData.dateOfBirth,
            ),
        } as SpidUser;
      }),
      TE.bimap(
        () => done(null, false),
        (user) => done(null, user),
      ),
    )().catch((err) => {
      // This should doesn't happens, the left side is included on the `then` path
      log.error("localStrategy|unexpected error:%s", err);
      done(null, false);
    });
  });
