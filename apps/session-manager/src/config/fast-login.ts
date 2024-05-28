/* eslint-disable turbo/no-undeclared-env-vars */
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
import { NonNegativeIntegerFromString } from "@pagopa/ts-commons/lib/numbers";
import { Second } from "@pagopa/ts-commons/lib/units";
import { getIsUserElegibleForfastLogin } from "../utils/fast-login";
import { log } from "../utils/logger";

// LV FF variable
export const FF_FAST_LOGIN = pipe(
  process.env.FF_FAST_LOGIN,
  FeatureFlag.decode,
  E.getOrElseW(() => FeatureFlagEnum.NONE),
);

export const LV_TEST_USERS = pipe(
  process.env.LV_TEST_USERS,
  O.fromNullable,
  O.map(
    flow(
      CommaSeparatedListOf(FiscalCode).decode,
      E.getOrElseW((err) => {
        throw new Error(`Invalid LV_TEST_USERS value: ${readableReport(err)}`);
      }),
    ),
  ),
  O.getOrElseW(() => []),
);

export const isUserElegibleForFastLogin = getIsUserElegibleForfastLogin(
  LV_TEST_USERS,
  FF_FAST_LOGIN,
);

// Set default LV token duration
const DEFAULT_LV_TOKEN_DURATION_IN_SECONDS = 60 * 15;
export const lvTokenDurationSecs = pipe(
  process.env.LV_TOKEN_DURATION_IN_SECONDS,
  NonNegativeIntegerFromString.decode,
  E.getOrElse(() => DEFAULT_LV_TOKEN_DURATION_IN_SECONDS),
) as Second;
log.info("LV Session token duration set to %s seconds", lvTokenDurationSecs);

// Set default LV session duration
const DEFAULT_LV_LONG_SESSION_DURATION_IN_SECONDS = 3600 * 24 * 365;
export const lvLongSessionDurationSecs = pipe(
  process.env.LV_LONG_SESSION_DURATION_IN_SECONDS,
  NonNegativeIntegerFromString.decode,
  E.getOrElse(() => DEFAULT_LV_LONG_SESSION_DURATION_IN_SECONDS),
) as Second;
log.info(
  "LV Long Session duration set to %s seconds",
  lvLongSessionDurationSecs,
);
