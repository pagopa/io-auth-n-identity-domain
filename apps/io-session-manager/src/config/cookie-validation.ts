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
import { getIsUserEligibleForCookieValidation } from "../utils/cookie-validation";

export const FF_COOKIE_VALIDATION = pipe(
  process.env.FF_COOKIE_VALIDATION,
  FeatureFlag.decode,
  E.getOrElseW(() => FeatureFlagEnum.NONE),
);

export const COOKIE_VALIDATION_TEST_USERS = pipe(
  process.env.COOKIE_VALIDATION_TEST_USERS,
  O.fromNullable,
  O.map(
    flow(
      CommaSeparatedListOf(FiscalCode).decode,
      E.getOrElseW((err) => {
        throw new Error(
          `Invalid COOKIE_VALIDATION_TEST_USERS value: ${readableReport(err)}`,
        );
      }),
    ),
  ),
  O.getOrElseW(() => []),
);

export const isUserElegibleForCookieValidation =
  getIsUserEligibleForCookieValidation(
    COOKIE_VALIDATION_TEST_USERS,
    FF_COOKIE_VALIDATION,
  );
