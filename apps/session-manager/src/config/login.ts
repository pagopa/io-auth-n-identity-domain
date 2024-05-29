/* eslint-disable turbo/no-undeclared-env-vars */
import {
  FeatureFlag,
  FeatureFlagEnum,
  getIsUserEligibleForNewFeature,
} from "@pagopa/ts-commons/lib/featureFlag";
import { flow, pipe } from "fp-ts/lib/function";
import * as E from "fp-ts/Either";
import { FiscalCode, NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { CommaSeparatedListOf } from "@pagopa/ts-commons/lib/comma-separated-list";
import { readableReport } from "@pagopa/ts-commons/lib/reporters";
import * as O from "fp-ts/Option";
import * as A from "fp-ts/lib/Array";
import { Second } from "@pagopa/ts-commons/lib/units";
import { getRequiredENVVar } from "../utils/environment";
import { getIsUserElegibleForIoLoginUrlScheme } from "../utils/login-uri-scheme";

// Password login params
export const TEST_LOGIN_FISCAL_CODES: ReadonlyArray<FiscalCode> = pipe(
  process.env.TEST_LOGIN_FISCAL_CODES,
  NonEmptyString.decode,
  E.map((_) => _.split(",")),
  E.map((_) => A.rights(_.map(FiscalCode.decode))),
  E.getOrElseW(() => []),
);

export const FF_USER_AGE_LIMIT_ENABLED =
  process.env.FF_USER_AGE_LIMIT_ENABLED === "1";

// IOLOGIN FF variable
export const FF_IOLOGIN = pipe(
  process.env.FF_IOLOGIN,
  FeatureFlag.decode,
  E.getOrElseW(() => FeatureFlagEnum.NONE),
);

export const IOLOGIN_USERS_LIST = pipe(
  process.env.IOLOGIN_TEST_USERS,
  O.fromNullable,
  O.map(
    flow(
      CommaSeparatedListOf(FiscalCode).decode,
      E.getOrElseW((err) => {
        throw new Error(
          `Invalid IOLOGIN_TEST_USERS value: ${readableReport(err)}`,
        );
      }),
    ),
  ),
  O.getOrElseW(() => []),
);

export const IOLOGIN_CANARY_USERS_SHA_REGEX = pipe(
  process.env.IOLOGIN_CANARY_USERS_REGEX,
  NonEmptyString.decode,
  // allow ~6% of users by default
  E.getOrElse(() => "^([(0-9)|(a-f)|(A-F)]{63}0)$" as NonEmptyString),
);

// Needed to forward SPID/CIE successful login
export const USERS_LOGIN_STORAGE_CONNECTION_STRING = getRequiredENVVar(
  "USERS_LOGIN_STORAGE_CONNECTION_STRING",
);
export const USERS_LOGIN_QUEUE_NAME = getRequiredENVVar(
  "USERS_LOGIN_QUEUE_NAME",
);

// UNIQUE EMAIL ENFORCEMENT variables

export const FF_UNIQUE_EMAIL_ENFORCEMENT = pipe(
  process.env.FF_UNIQUE_EMAIL_ENFORCEMENT,
  FeatureFlag.decode,
  E.getOrElseW(() => FeatureFlagEnum.NONE),
);

export const UNIQUE_EMAIL_ENFORCEMENT_USERS = pipe(
  process.env.UNIQUE_EMAIL_ENFORCEMENT_USERS,
  // TODO(IOPID-1256): produce a ReadonlySet instead of ReadonlyArray
  O.fromNullable,
  O.map((_) =>
    pipe(
      _,
      CommaSeparatedListOf(FiscalCode).decode,
      E.getOrElseW((err) => {
        throw new Error(
          `Invalid UNIQUE_EMAIL_ENFORCEMENT_USERS value: ${readableReport(err)}`,
        );
      }),
    ),
  ),
  O.getOrElseW(() => []),
) as unknown as FiscalCode[]; // Cast needed to remove never[] type from throw

export const FF_UNIQUE_EMAIL_ENFORCEMENT_ENABLED =
  getIsUserEligibleForNewFeature<FiscalCode>(
    (fiscalCode) => UNIQUE_EMAIL_ENFORCEMENT_USERS.includes(fiscalCode),
    () => false,
    FF_UNIQUE_EMAIL_ENFORCEMENT,
  );

// SPID Email Persistence FF

export const IS_SPID_EMAIL_PERSISTENCE_ENABLED = pipe(
  O.fromNullable(process.env.IS_SPID_EMAIL_PERSISTENCE_ENABLED),
  O.map((val) => val.toLowerCase() === "true"),
  O.getOrElse(() => true),
);

// Set default session duration to 30 days
const DEFAULT_TOKEN_DURATION_IN_SECONDS = (3600 * 24 * 30) as Second;
export const standardTokenDurationSecs = process.env.TOKEN_DURATION_IN_SECONDS
  ? (parseInt(process.env.TOKEN_DURATION_IN_SECONDS, 10) as Second)
  : DEFAULT_TOKEN_DURATION_IN_SECONDS;

export const isUserElegibleForIoLoginUrlScheme =
  getIsUserElegibleForIoLoginUrlScheme(
    IOLOGIN_USERS_LIST,
    IOLOGIN_CANARY_USERS_SHA_REGEX,
    FF_IOLOGIN,
  );

export const TEST_LOGIN_PASSWORD = NonEmptyString.decode(
  process.env.TEST_LOGIN_PASSWORD,
);
