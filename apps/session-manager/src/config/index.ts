/* eslint-disable turbo/no-undeclared-env-vars */
import { readableReportSimplified } from "@pagopa/ts-commons/lib/reporters";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/lib/function";
import {
  NodeEnvironmentEnum,
  getNodeEnvironmentFromProcessEnv,
} from "@pagopa/ts-commons/lib/environment";
import { log } from "../utils/logger";
import { IoLoginHostUrl } from "../types/common";

import * as BPDConfig from "./bpd";
import * as FnAppConfig from "./fn-app";
import * as FastLoginConfig from "./fast-login";
import * as LockProfileConfig from "./lock-profile";
import * as LoginConfig from "./login";
import * as LollipopConfig from "./lollipop";
import * as SpidConfig from "./spid";
import * as SpidLogConfig from "./spid-logs";
import * as ZendeskConfig from "./zendesk";
import * as PagoPAConfig from "./pagopa";
import * as AppInsightsConfig from "./appinsights";
import * as FimsConfig from "./fims";

export const ENV = getNodeEnvironmentFromProcessEnv(process.env);

export const isDevEnv =
  getNodeEnvironmentFromProcessEnv(process.env) ===
  NodeEnvironmentEnum.DEVELOPMENT;

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

export {
  BPDConfig,
  FnAppConfig,
  FastLoginConfig,
  LockProfileConfig,
  LoginConfig,
  LollipopConfig,
  SpidConfig,
  SpidLogConfig,
  ZendeskConfig,
  PagoPAConfig,
  AppInsightsConfig,
  FimsConfig,
};
