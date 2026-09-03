import * as E from "fp-ts/Either";
import * as O from "fp-ts/Option";
import { pipe } from "fp-ts/lib/function";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { NonNegativeIntegerFromString } from "@pagopa/ts-commons/lib/numbers";
import { Second } from "@pagopa/ts-commons/lib/units";
import { UrlFromString } from "@pagopa/ts-commons/lib/url";
import { getRequiredENVVar } from "../utils/environment";
import { log } from "../utils/logger";
import { OidcConfigurationEnv } from "../generated/backend/OidcConfigurationEnv";

/**
 * Resolved OneIdentity (OIDC provider) configuration for a single
 * environment (PROD/UAT).
 *
 * `redirectUri` is the callback URL registered on the OIDC provider for
 * this application (shared across environments), while `issuer` is the
 * OIDC provider's issuer URL for the given environment, used to perform
 * OIDC discovery.
 */
export type OidcEnvConfig = {
  clientId: NonEmptyString;
  clientSecret: NonEmptyString;
  issuer: UrlFromString;
  redirectUri: UrlFromString;
};

const decodeRequiredUrl = (envName: string): UrlFromString =>
  pipe(
    getRequiredENVVar(envName),
    UrlFromString.decode,
    E.getOrElseW(() => {
      log.error("Invalid %s environment variable, expected a valid url", {
        envName,
      });
      return process.exit(1);
    }),
  );

const ONEID_PROD_CLIENT_ID = getRequiredENVVar(
  "ONEID_PROD_CLIENT_ID",
) as NonEmptyString;
const ONEID_PROD_CLIENT_SECRET = getRequiredENVVar(
  "ONEID_PROD_CLIENT_SECRET",
) as NonEmptyString;
const ONEID_PROD_ISSUER = decodeRequiredUrl("ONEID_PROD_ISSUER");
const ONEID_PROD_REDIRECT_URI = decodeRequiredUrl("ONEID_PROD_REDIRECT_URI");

const ONEID_UAT_CLIENT_ID = pipe(
  process.env.ONEID_UAT_CLIENT_ID,
  NonEmptyString.decode,
  O.fromEither,
);
const ONEID_UAT_CLIENT_SECRET = pipe(
  process.env.ONEID_UAT_CLIENT_SECRET,
  NonEmptyString.decode,
  O.fromEither,
);
const ONEID_UAT_ISSUER = pipe(
  process.env.ONEID_UAT_ISSUER,
  UrlFromString.decode,
  O.fromEither,
);

// Timeout (seconds) applied to every HTTP request towards the OIDC provider
// (discovery, JWKS, token endpoint). Prevents slow upstream responses from
// exhausting connections under load.
const DEFAULT_ONEID_HTTP_TIMEOUT_SECONDS = 8;
export const ONEID_HTTP_TIMEOUT_SECONDS = pipe(
  process.env.ONEID_HTTP_TIMEOUT_SECONDS,
  NonNegativeIntegerFromString.decode,
  E.getOrElse(() => DEFAULT_ONEID_HTTP_TIMEOUT_SECONDS),
);

// TTL (seconds) applied to the ausiliar data stored between the `reserve`
// and the (future) `callback` steps of the OneIdentity login flow.
const DEFAULT_LOGIN_AUSILIAR_DATA_TTL_SECONDS = 900;
export const LOGIN_AUSILIAR_DATA_TTL_SECONDS = pipe(
  process.env.LOGIN_AUSILIAR_DATA_TTL_SECONDS,
  NonNegativeIntegerFromString.decode,
  E.getOrElse(() => DEFAULT_LOGIN_AUSILIAR_DATA_TTL_SECONDS),
) as Second;

const configByEnv: Readonly<{
  PROD: OidcEnvConfig;
  UAT?: OidcEnvConfig;
}> = {
  PROD: {
    clientId: ONEID_PROD_CLIENT_ID,
    clientSecret: ONEID_PROD_CLIENT_SECRET,
    issuer: ONEID_PROD_ISSUER,
    redirectUri: ONEID_PROD_REDIRECT_URI,
  },
  ...pipe(
    O.Do,
    O.bind("clientId", () => ONEID_UAT_CLIENT_ID),
    O.bind("clientSecret", () => ONEID_UAT_CLIENT_SECRET),
    O.bind("issuer", () => ONEID_UAT_ISSUER),
    O.map(({ clientId, clientSecret, issuer }) => ({
      UAT: {
        clientId,
        clientSecret,
        issuer,
        redirectUri: ONEID_PROD_REDIRECT_URI,
      },
    })),
    O.getOrElse(() => ({}) as Partial<Record<"UAT", OidcEnvConfig>>),
  ),
};

/**
 * Resolves the OneIdentity configuration for the given environment.
 * The `UAT` environment is optional: when its env vars are not provided,
 * requests for `UAT` are rejected with a `Left`.
 */
export const getOneIdEnvConfig = (
  env: OidcConfigurationEnv,
): E.Either<Error, OidcEnvConfig> =>
  pipe(
    configByEnv[env],
    O.fromNullable,
    E.fromOption(
      () => new Error(`Missing OIDC configuration for environment "${env}"`),
    ),
  );
