/* eslint-disable turbo/no-undeclared-env-vars */
import { IntegerFromString } from "@pagopa/ts-commons/lib/numbers";
import { Second } from "@pagopa/ts-commons/lib/units";
import { pipe } from "fp-ts/function";
import * as E from "fp-ts/Either";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import {
  readableReport,
  readableReportSimplified,
} from "@pagopa/ts-commons/lib/reporters";
import { log } from "../utils/logger";

const DEFAULT_JWT_ZENDESK_SUPPORT_TOKEN_EXPIRATION = 604800 as Second;
export const JWT_ZENDESK_SUPPORT_TOKEN_EXPIRATION: Second = pipe(
  process.env.JWT_ZENDESK_SUPPORT_TOKEN_EXPIRATION,
  IntegerFromString.decode,
  E.getOrElseW(() => DEFAULT_JWT_ZENDESK_SUPPORT_TOKEN_EXPIRATION),
) as Second;

log.info(
  "JWT Zendesk support token expiration set to %s seconds",
  JWT_ZENDESK_SUPPORT_TOKEN_EXPIRATION,
);

// Zendesk support Token
export const JWT_ZENDESK_SUPPORT_TOKEN_SECRET = pipe(
  process.env.JWT_ZENDESK_SUPPORT_TOKEN_SECRET,
  NonEmptyString.decode,
  E.getOrElseW((errs) => {
    log.error(
      `Missing or invalid JWT_ZENDESK_SUPPORT_TOKEN_SECRET environment variable: ${readableReportSimplified(
        errs,
      )}`,
    );
    return process.exit(1);
  }),
);
export const JWT_ZENDESK_SUPPORT_TOKEN_ISSUER = pipe(
  process.env.JWT_ZENDESK_SUPPORT_TOKEN_ISSUER,
  NonEmptyString.decode,
  E.getOrElseW((errs) => {
    log.error(
      `Missing or invalid JWT_ZENDESK_SUPPORT_TOKEN_ISSUER environment variable: ${readableReport(
        errs,
      )}`,
    );
    return process.exit(1);
  }),
);
