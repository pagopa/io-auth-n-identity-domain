/* eslint-disable turbo/no-undeclared-env-vars */
import * as E from "fp-ts/Either";
import * as O from "fp-ts/Option";
import { pipe } from "fp-ts/lib/function";
import { NonNegativeIntegerFromString } from "@pagopa/ts-commons/lib/numbers";
import { OidcConfigurationEnv } from "../generated/backend/OidcConfigurationEnv";
import { getRequiredENVVar } from "../utils/environment";
import { decodeRequiredUrl } from "./one-id";
import { UrlFromString, ValidUrl } from "@pagopa/ts-commons/lib/url";

const IDP_FRIENDLY_NAMES_PROD_URL = decodeRequiredUrl(
  "IDP_FRIENDLY_NAMES_PROD_URL",
);

const IDP_FRIENDLY_NAMES_UAT_URL = pipe(
  process.env.IDP_FRIENDLY_NAMES_UAT_URL,
  UrlFromString.decode,
  E.getOrElseW(() => undefined),
);

const IDP_FRIENDLY_NAMES_URLS_BY_ENV: Readonly<{
  PROD: ValidUrl;
  UAT?: ValidUrl;
}> = {
  PROD: IDP_FRIENDLY_NAMES_PROD_URL,
  UAT: IDP_FRIENDLY_NAMES_UAT_URL,
};

// 15 min
const DEFAULT_IDP_FRIENDLY_NAMES_CACHE_TTL_SECONDS = 15 * 60;
export const IDP_FRIENDLY_NAMES_CACHE_TTL_SECONDS = pipe(
  process.env.IDP_FRIENDLY_NAMES_CACHE_TTL_SECONDS,
  NonNegativeIntegerFromString.decode,
  E.getOrElse(() => DEFAULT_IDP_FRIENDLY_NAMES_CACHE_TTL_SECONDS),
);

// Timeout (seconds) applied to the assets CDN request
// so a slow CDN cannot exhaust connections under load.
const DEFAULT_IDP_FRIENDLY_NAMES_HTTP_TIMEOUT_SECONDS = 4;
export const IDP_FRIENDLY_NAMES_HTTP_TIMEOUT_SECONDS = pipe(
  process.env.IDP_FRIENDLY_NAMES_HTTP_TIMEOUT_SECONDS,
  NonNegativeIntegerFromString.decode,
  E.getOrElse(() => DEFAULT_IDP_FRIENDLY_NAMES_HTTP_TIMEOUT_SECONDS),
);

export const getIdpFriendlyNamesUrl = (
  env: OidcConfigurationEnv,
): E.Either<Error, ValidUrl> =>
  pipe(
    IDP_FRIENDLY_NAMES_URLS_BY_ENV[env],
    O.fromNullable,
    E.fromOption(
      () => new Error(`IDP friendly names URL not found for env: ${env}`),
    ),
  );
