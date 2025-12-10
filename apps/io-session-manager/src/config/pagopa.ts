/* eslint-disable turbo/no-undeclared-env-vars */
import * as E from "fp-ts/Either";
import * as O from "fp-ts/Option";
import { readableReportSimplified } from "@pagopa/ts-commons/lib/reporters";
import { pipe } from "fp-ts/function";
import { log } from "../utils/logger";
import { decodeCIDRs } from "../utils/network";

// IP(s) or CIDR(s) allowed for payment manager endpoint
export const ALLOW_PAGOPA_IP_SOURCE_RANGE = pipe(
  process.env.ALLOW_PAGOPA_IP_SOURCE_RANGE,
  decodeCIDRs,
  E.getOrElseW((errs) => {
    log.error(
      `Missing or invalid ALLOW_PAGOPA_IP_SOURCE_RANGE environment variable: ${readableReportSimplified(
        errs,
      )}`,
    );
    return process.exit(1);
  }),
);

export const ENABLE_NOTICE_EMAIL_CACHE: boolean = pipe(
  process.env.ENABLE_NOTICE_EMAIL_CACHE,
  O.fromNullable,
  O.map((_) => _.toLowerCase() === "true"),
  O.getOrElseW(() => false),
);
