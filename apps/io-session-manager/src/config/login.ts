/* eslint-disable turbo/no-undeclared-env-vars */
import {
  FeatureFlag,
  FeatureFlagEnum,
} from "@pagopa/ts-commons/lib/featureFlag";
import { flow, pipe } from "fp-ts/lib/function";
import * as E from "fp-ts/Either";
import * as TE from "fp-ts/TaskEither";
import { FiscalCode, NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { CommaSeparatedListOf } from "@pagopa/ts-commons/lib/comma-separated-list";
import { readableReport } from "@pagopa/ts-commons/lib/reporters";
import * as O from "fp-ts/Option";
import * as A from "fp-ts/Array";
import { Second } from "@pagopa/ts-commons/lib/units";
import { getIsUserElegibleForIoLoginUrlScheme } from "../utils/login-uri-scheme";
import { gunzipSync } from "zlib";

// Password login params
export const TEST_LOGIN_FISCAL_CODES: ReadonlyArray<FiscalCode> = pipe(
  process.env.TEST_LOGIN_FISCAL_CODES,
  NonEmptyString.decode,
  E.map((_) => _.split(",")),
  E.map((_) => A.rights(_.map(FiscalCode.decode))),
  E.getOrElseW(() => []),
);

export function decompressFiscalCodeList(envVar?: string) {
  return pipe(
    envVar,
    NonEmptyString.decode,
    E.map((_) => Buffer.from(_, "base64")),
    E.map((buffer) => {
      try {
        const decompressedBuffer = gunzipSync(buffer).toString();
        return decompressedBuffer;
      } catch (err) {
        throw Error(`Invalid compressed FiscalCode list value: ${err}`);
      }
    }),
    E.map((_) => _.split(",")),
    E.map((_) => A.rights(_.map(FiscalCode.decode))),
    E.getOrElseW(() => []),
  );
}

// Password login params
export const TEST_LOGIN_FISCAL_CODES_COMPRESSED: ReadonlyArray<FiscalCode> =
  decompressFiscalCodeList(process.env.TEST_LOGIN_FISCAL_CODES_COMPRESSED);

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

export const isTestUser = (fiscalCode: FiscalCode) =>
  TEST_LOGIN_FISCAL_CODES_COMPRESSED.includes(fiscalCode);
