/* eslint-disable turbo/no-undeclared-env-vars */
import * as E from "fp-ts/Either";
import { readableReportSimplified } from "@pagopa/ts-commons/lib/reporters";
import { pipe } from "fp-ts/function";
import { log } from "../utils/logger";
import { decodeCIDRs } from "../utils/network";

// IP(s) or CIDR(s) allowed for fims endpoints
export const ALLOW_FIMS_IP_SOURCE_RANGE = pipe(
  process.env.ALLOW_FIMS_IP_SOURCE_RANGE,
  decodeCIDRs,
  E.getOrElseW((errs) => {
    log.error(
      `Missing or invalid ALLOW_FIMS_IP_SOURCE_RANGE environment variable: ${readableReportSimplified(
        errs,
      )}`,
    );
    return process.exit(1);
  }),
);
