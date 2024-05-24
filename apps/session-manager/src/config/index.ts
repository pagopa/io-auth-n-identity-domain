/* eslint-disable turbo/no-undeclared-env-vars */
import { readableReportSimplified } from "@pagopa/ts-commons/lib/reporters";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/lib/function";
import { getNodeEnvironmentFromProcessEnv } from "@pagopa/ts-commons/lib/environment";
import { log } from "../utils/logger";
import { IoLoginHostUrl } from "../types/common";

import * as BPDConfig from "./bpd";
import * as LollipopConfig from "./lollipop";
import * as SpidConfig from "./spid";
import * as SpidLogConfig from "./spid-logs";
import * as ZendeskConfig from "./zendesk";

export const ENV = getNodeEnvironmentFromProcessEnv(process.env);

export const BACKEND_HOST = pipe(
  process.env.BACKEND_HOST,
  IoLoginHostUrl.decode,
  E.getOrElseW((errors) => {
    log.error(
      `BACKEND_HOST env variable error | ${readableReportSimplified(errors)}`,
    );
    return process.exit(1);
  }),
);

export { BPDConfig, LollipopConfig, SpidConfig, SpidLogConfig, ZendeskConfig };
