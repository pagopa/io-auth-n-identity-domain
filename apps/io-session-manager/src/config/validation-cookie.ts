import { flow, pipe } from "fp-ts/lib/function";
import * as E from "fp-ts/Either";
import { readableReport } from "@pagopa/ts-commons/lib/reporters";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import {
  FeatureFlag,
  FeatureFlagEnum,
} from "@pagopa/ts-commons/lib/featureFlag";
import { CommaSeparatedListOf } from "@pagopa/ts-commons/lib/comma-separated-list";
import * as O from "fp-ts/Option";
import { CookieOptions } from "express";
import { NumberFromString } from "@pagopa/ts-commons/lib/numbers";
import { getIsUserEligibleForValidationCookie } from "../utils/validation-cookie";

export const VALIDATION_COOKIE_DURATION_MS = pipe(
  process.env.VALIDATION_COOKIE_DURATION_MS,
  NumberFromString.decode,
  // 15 minutes expressed as milliseconds
  E.getOrElse(() => 1000 * 60 * 15),
);

export const VALIDATION_COOKIE_NAME = "__Host-validation";
export const VALIDATION_COOKIE_SETTINGS: CookieOptions = {
  sameSite: "none",
  maxAge: VALIDATION_COOKIE_DURATION_MS,
  secure: true,
  httpOnly: true,
};

export const FF_VALIDATION_COOKIE = pipe(
  process.env.FF_VALIDATION_COOKIE,
  FeatureFlag.decode,
  E.getOrElseW(() => FeatureFlagEnum.NONE),
);

export const VALIDATION_COOKIE_TEST_USERS = pipe(
  process.env.VALIDATION_COOKIE_TEST_USERS,
  O.fromNullable,
  O.map(
    flow(
      CommaSeparatedListOf(FiscalCode).decode,
      E.getOrElseW((err) => {
        throw new Error(
          `Invalid VALIDATION_COOKIE_TEST_USERS value: ${readableReport(err)}`,
        );
      }),
    ),
  ),
  O.getOrElseW(() => []),
);

export const isUserElegibleForValidationCookie =
  getIsUserEligibleForValidationCookie(
    VALIDATION_COOKIE_TEST_USERS,
    FF_VALIDATION_COOKIE,
  );
