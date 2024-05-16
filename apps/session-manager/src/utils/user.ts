import {
  IResponse,
  IResponseErrorValidation,
} from "@pagopa/ts-commons/lib/responses";
import * as RTE from "fp-ts/ReaderTaskEither";
import express from "express";
import * as O from "fp-ts/Option";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/lib/function";
import {
  errorsToReadableMessages,
  readableReport,
} from "@pagopa/ts-commons/lib/reporters";
import { SpidObject, SpidUser, User } from "../types/user";
import { isSpidL } from "../types/spid";
import { SpidLevelEnum } from "../types/spid-level";
import {
  BPDToken,
  FIMSToken,
  MyPortalToken,
  SessionToken,
  WalletToken,
  ZendeskToken,
} from "../types/token";
import {
  withValidatedOrValidationError,
  withValidatedOrValidationErrorRTE,
} from "./responses";
import { WithExpressRequest } from "./express";
import { getAuthnContextFromResponse } from "./spid";
import { log } from "./logger";
import { formatDate } from "./date";

export type WithUser = {
  user: User;
};

/**
 * Extends the RTE dependencies in input with the User retrieved
 * from the express Request and pass they to an hendler. If the user is missing or
 * malformed a validation error is returned.
 * @param controllerHandler The handler of the API requests
 */
export const withUserFromRequest =
  <D extends WithExpressRequest, R extends IResponse<T>, T>(
    controllerHandler: RTE.ReaderTaskEither<D & WithUser, Error, R>,
  ): RTE.ReaderTaskEither<D, Error, IResponseErrorValidation | R> =>
  (deps) =>
    withValidatedOrValidationErrorRTE(User.decode(deps.req.user), (user) =>
      controllerHandler({
        user,
        ...deps,
      }),
    );

export const withOptionalUserFromRequest = async <T>(
  req: express.Request,
  f: (user: O.Option<User>) => Promise<T>,
): Promise<IResponseErrorValidation | T> =>
  withValidatedOrValidationError(
    req.user ? pipe(User.decode(req.user), E.map(O.some)) : E.right(O.none),
    f,
  );

/**
 * Validates a SPID User extracted from a SAML response.
 */
export const validateSpidUser = (
  rawValue: unknown,
): E.Either<string, SpidUser> => {
  const validated = SpidObject.decode(rawValue);
  if (E.isLeft(validated)) {
    return E.left(`validateSpidUser: ${readableReport(validated.left)}`);
  }

  const value = validated.right;

  // Remove the international prefix from fiscal number.
  const FISCAL_NUMBER_INTERNATIONAL_PREFIX = "TINIT-";
  const fiscalNumberWithoutPrefix = value.fiscalNumber.replace(
    FISCAL_NUMBER_INTERNATIONAL_PREFIX,
    "",
  );

  const maybeAuthnContextClassRef = getAuthnContextFromResponse(
    value.getAssertionXml(),
  );

  // Set SPID level to a default (SPID_L2) if the expected value is not available
  // in the SAML assertion.
  // Actually the value returned by the test idp is invalid
  // @see https://github.com/italia/spid-testenv/issues/26
  const authnContextClassRef = pipe(
    maybeAuthnContextClassRef,
    O.filter(isSpidL),
    O.getOrElse(() => SpidLevelEnum["https://www.spid.gov.it/SpidL2"]),
  );

  const valueWithoutPrefix = {
    ...value,
    fiscalNumber: fiscalNumberWithoutPrefix.toUpperCase(),
  };

  const valueWithDefaultSPIDLevel = {
    ...valueWithoutPrefix,
    authnContextClassRef,
  };

  // Log the invalid SPID level to audit IDP responses.
  if (!isSpidL(valueWithDefaultSPIDLevel.authnContextClassRef)) {
    log.warn(
      "Response from IDP: %s doesn't contain a valid SPID level: %s",
      value.issuer,
      value.authnContextClassRef,
    );
  }

  return pipe(
    SpidUser.decode(valueWithDefaultSPIDLevel),
    E.mapLeft(
      (err) =>
        "Cannot validate SPID user object: " +
        errorsToReadableMessages(err).join(" / "),
    ),
  );
};

/**
 * Converts a SPID User to a Proxy User.
 */
// eslint-disable-next-line max-params
export function toAppUser(
  from: SpidUser,
  sessionToken: SessionToken,
  walletToken: WalletToken,
  myPortalToken: MyPortalToken,
  bpdToken: BPDToken,
  zendeskToken: ZendeskToken,
  fimsToken: FIMSToken,
  sessionTrackingId: string,
): User {
  return {
    bpd_token: bpdToken,
    created_at: new Date().getTime(),
    date_of_birth: formatDate(from.dateOfBirth),
    family_name: from.familyName,
    fims_token: fimsToken,
    fiscal_code: from.fiscalNumber,
    myportal_token: myPortalToken,
    name: from.name,
    session_token: sessionToken,
    session_tracking_id: sessionTrackingId,
    spid_email: from.email,
    spid_level: from.authnContextClassRef,
    wallet_token: walletToken,
    zendesk_token: zendeskToken,
  };
}
