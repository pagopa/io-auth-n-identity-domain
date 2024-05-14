/* eslint-disable turbo/no-undeclared-env-vars */
import { pipe } from "fp-ts/lib/function";
import * as E from "fp-ts/Either";
import { readableReport } from "@pagopa/ts-commons/lib/reporters";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import {
  FeatureFlag,
  FeatureFlagEnum,
} from "@pagopa/ts-commons/lib/featureFlag";
import { CommaSeparatedListOf } from "@pagopa/ts-commons/lib/comma-separated-list";
import { getIsUserElegibleForfastLogin } from "../utils/fast-login";

// LV FF variable
export const FF_FAST_LOGIN = pipe(
  process.env.FF_FAST_LOGIN,
  FeatureFlag.decode,
  E.getOrElseW(() => FeatureFlagEnum.NONE),
);

export const LV_TEST_USERS = pipe(
  process.env.LV_TEST_USERS,
  CommaSeparatedListOf(FiscalCode).decode,
  E.getOrElseW((err) => {
    throw new Error(`Invalid LV_TEST_USERS value: ${readableReport(err)}`);
  }),
);

export const isUserElegibleForFastLogin = getIsUserElegibleForfastLogin(
  LV_TEST_USERS,
  FF_FAST_LOGIN,
);
