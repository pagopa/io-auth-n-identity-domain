/* eslint-disable turbo/no-undeclared-env-vars */
import { pipe } from "fp-ts/lib/function";
import * as E from "fp-ts/Either";
import { readableReport } from "@pagopa/ts-commons/lib/reporters";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import { FeatureFlag, FeatureFlagEnum } from "../types/fature-flag";
import { getIsUserElegibleForfastLogin } from "../utils/fast-login";
import { CommaSeparatedListOf } from "../types/separated-list";

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
