/* eslint-disable turbo/no-undeclared-env-vars */
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/function";
import { readableReportSimplified } from "@pagopa/ts-commons/lib/reporters";
import { getRequiredENVVar } from "../utils/environment";
import { log } from "../utils/logger";
import { decodeCIDRs } from "../utils/network";

export const BPD_BASE_PATH = getRequiredENVVar("BPD_BASE_PATH");

// IP(s) or CIDR(s) allowed for bpd endpoint
export const ALLOW_BPD_IP_SOURCE_RANGE = pipe(
  process.env.ALLOW_BPD_IP_SOURCE_RANGE,
  decodeCIDRs,
  E.getOrElseW((errs) => {
    log.error(
      `Missing or invalid ALLOW_BPD_IP_SOURCE_RANGE environment variable: ${readableReportSimplified(
        errs,
      )}`,
    );
    return process.exit(1);
  }),
);
