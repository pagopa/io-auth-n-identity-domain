/* eslint-disable turbo/no-undeclared-env-vars */
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/lib/function";
import { NonNegativeIntegerFromString } from "@pagopa/ts-commons/lib/numbers";
import { OidcConfigurationEnv } from "../generated/backend/OidcConfigurationEnv";
import { getRequiredENVVar } from "../utils/environment";

export const IDP_FRIENDLY_NAMES_URLS: Record<OidcConfigurationEnv, string> = {
  PROD: getRequiredENVVar("IDP_FRIENDLY_NAMES_PROD_URL"),
  UAT: getRequiredENVVar("IDP_FRIENDLY_NAMES_UAT_URL"),
};

// 15 min
const DEFAULT_IDP_FRIENDLY_NAMES_CACHE_TTL_SECONDS = 15 * 60;
export const IDP_FRIENDLY_NAMES_CACHE_TTL_SECONDS = pipe(
  process.env.IDP_FRIENDLY_NAMES_CACHE_TTL_SECONDS,
  NonNegativeIntegerFromString.decode,
  E.getOrElse(() => DEFAULT_IDP_FRIENDLY_NAMES_CACHE_TTL_SECONDS),
);

// Timeout (seconds) applied to the assets CDN request. Reuses the OneID HTTP
// timeout so a slow CDN cannot exhaust connections under load.
const DEFAULT_ONEID_HTTP_TIMEOUT_SECONDS = 4;
export const IDP_FRIENDLY_NAMES_HTTP_TIMEOUT_SECONDS = pipe(
  process.env.ONEID_HTTP_TIMEOUT_SECONDS,
  NonNegativeIntegerFromString.decode,
  E.getOrElse(() => DEFAULT_ONEID_HTTP_TIMEOUT_SECONDS),
);
