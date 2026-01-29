/* eslint-disable turbo/no-undeclared-env-vars */
import {
  IApplicationConfig,
  IServiceProviderConfig,
  SamlConfig,
} from "@pagopa/io-spid-commons";
import {
  errorsToReadableMessages,
  readableReport,
} from "@pagopa/ts-commons/lib/reporters";
import * as E from "fp-ts/Either";
import { flow, pipe } from "fp-ts/lib/function";
import { NodeEnvironmentEnum } from "@pagopa/ts-commons/lib/environment";
import * as O from "fp-ts/Option";
import * as t from "io-ts";
import { IntegerFromString } from "@pagopa/ts-commons/lib/numbers";
import { FiscalCode, NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { record } from "fp-ts";
import { UrlFromString } from "@pagopa/ts-commons/lib/url";
import * as S from "fp-ts/lib/string";
import { CommaSeparatedListOf } from "@pagopa/ts-commons/lib/comma-separated-list";
import { log } from "../utils/logger";
import { STRINGS_RECORD, readFile } from "../types/common";
import { SpidLevelArray } from "../types/spid";
import { getRequiredENVVar } from "../utils/environment";
import { ENV, BACKEND_HOST } from "./index";

// Redirection urls
export const CLIENT_ERROR_REDIRECTION_URL = `${BACKEND_HOST}/error.html`;

export const SPID_API_BASE_PATH = "/api/auth/v1";

export const clientProfileRedirectionUrlTemplate = `${BACKEND_HOST}/profile.html?token={token}#token={token}`;

export const getClientProfileRedirectionUrl = (token: string): UrlFromString =>
  pipe(
    clientProfileRedirectionUrlTemplate.replaceAll("{token}", token),
    UrlFromString.decode,
    E.getOrElseW(() => {
      throw new Error("Invalid url");
    }),
  );

export const CLIENT_REDIRECTION_URL =
  process.env.CLIENT_REDIRECTION_URL || "/login";

const SPID_LEVEL_WHITELIST = pipe(
  process.env.SPID_LEVEL_WHITELIST,
  O.fromNullable,
  O.map((_) => _.split(",")),
  O.fold(
    // SPID_LEVEL_WHITELIST is unset
    () => {
      if (ENV === NodeEnvironmentEnum.DEVELOPMENT) {
        // default config for development, all the spid levels are allowed
        return E.right<t.Errors, SpidLevelArray>([
          "SpidL1",
          "SpidL2",
          "SpidL3",
        ]);
      }
      // default config for production, only L2 and L3 are allowed
      return E.right<t.Errors, SpidLevelArray>(["SpidL2", "SpidL3"]);
    },
    (_) => SpidLevelArray.decode(_),
  ),
  E.getOrElseW((err) => {
    log.error(
      "Invalid value for SPID_LEVEL_WHITELIST env [%s]",
      readableReport(err),
    );
    return process.exit(1);
  }),
);

// SAML settings.
const SAML_CALLBACK_URL = getRequiredENVVar("SAML_CALLBACK_URL");
const SAML_LOGOUT_CALLBACK_URL = getRequiredENVVar("SAML_LOGOUT_CALLBACK_URL");
const SAML_ISSUER = process.env.SAML_ISSUER || "https://spid.agid.gov.it/cd";
const DEFAULT_SAML_ATTRIBUTE_CONSUMING_SERVICE_INDEX = "1";
const SAML_ATTRIBUTE_CONSUMING_SERVICE_INDEX =
  process.env.SAML_ATTRIBUTE_CONSUMING_SERVICE_INDEX ||
  DEFAULT_SAML_ATTRIBUTE_CONSUMING_SERVICE_INDEX;
// Default SAML Request cache is 10 minutes
const DEFAULT_SAML_REQUEST_EXPIRATION_PERIOD_MS = 10 * 60 * 1000;
const SAML_REQUEST_EXPIRATION_PERIOD_MS = pipe(
  process.env.SAML_REQUEST_EXPIRATION_PERIOD_MS,
  E.fromNullable(new Error("Missing Environment configuration")),
  E.chain((_) => pipe(IntegerFromString.decode(_), E.mapLeft(E.toError))),
  E.getOrElse(() => DEFAULT_SAML_REQUEST_EXPIRATION_PERIOD_MS),
);
const DEFAULT_SAML_ACCEPTED_CLOCK_SKEW_MS = "-1";
const SAML_ACCEPTED_CLOCK_SKEW_MS = parseInt(
  process.env.SAML_ACCEPTED_CLOCK_SKEW_MS ||
    DEFAULT_SAML_ACCEPTED_CLOCK_SKEW_MS,
  10,
);

// Register the spidStrategy.
export const IDP_METADATA_URL = getRequiredENVVar("IDP_METADATA_URL");
const CIE_METADATA_URL = getRequiredENVVar("CIE_METADATA_URL");
const CIE_TEST_METADATA_URL = process.env.CIE_TEST_METADATA_URL;
const SPID_TESTENV_URL = process.env.SPID_TESTENV_URL;

const hasClockSkewLoggingEvent = pipe(
  process.env.HAS_CLOCK_SKEW_LOG_EVENT,
  O.fromNullable,
  O.map((_) => _.toLowerCase() === "true"),
  O.getOrElse(() => false),
);

export const STARTUP_IDPS_METADATA: Record<string, string> | undefined = pipe(
  process.env.STARTUP_IDPS_METADATA,
  O.fromNullable,
  O.map((_) =>
    pipe(
      E.parseJSON(_, E.toError),
      E.chain(
        flow(
          STRINGS_RECORD.decode,
          E.mapLeft(
            (err) => new Error(errorsToReadableMessages(err).join(" / ")),
          ),
        ),
      ),
      E.getOrElseW(() => undefined),
    ),
  ),
  O.getOrElseW(() => undefined),
);

export const appConfig: IApplicationConfig = {
  // NOTE: the SPID endpoints are exposed with `api/auth/v1/` base path
  // but due to issues with metadata changes the metadata exposes
  // only `assertionConsumerService`. Therefore to spid-commons we pass the
  // entire URL to be exposed but the SAML_CALLBACK type of variables still
  // maps without `api/auth/v1` base path.
  assertionConsumerServicePath: `${SPID_API_BASE_PATH}/assertionConsumerService`,
  clientErrorRedirectionUrl: CLIENT_ERROR_REDIRECTION_URL,
  clientLoginRedirectionUrl: CLIENT_REDIRECTION_URL,
  hasClockSkewLoggingEvent,
  loginPath: `${SPID_API_BASE_PATH}/login`,
  metadataPath: `${SPID_API_BASE_PATH}/metadata`,
  sloPath: `${SPID_API_BASE_PATH}/slo`,
  spidLevelsWhitelist: SPID_LEVEL_WHITELIST,
  startupIdpsMetadata: STARTUP_IDPS_METADATA,
};

const maybeSpidValidatorUrlOption = pipe(
  process.env.SPID_VALIDATOR_URL,
  O.fromNullable,
  O.map((_) => ({ [_]: true })),
);
const maybeSpidTestenvOption = pipe(
  SPID_TESTENV_URL,
  O.fromNullable,
  O.map((_) => ({
    [_]: true,
  })),
);

/**
 * Boolean value that is `true` if some test issuer was provided in configuration.
 * When equals to `false` enable strict validation of the Issuer value retrieved from the SpidUser.
 */
export const ALLOWED_TEST_ISSUER =
  O.isSome(maybeSpidValidatorUrlOption) || O.isSome(maybeSpidTestenvOption);

// Public certificate used in SAML authentication to a SPID IDP.
const SAML_CERT = pipe(
  process.env.SAML_CERT,
  O.fromNullable,
  O.getOrElse(() =>
    readFile(
      process.env.SAML_CERT_PATH || "./certs/cert.pem",
      "SAML certificate",
    ),
  ),
);

// Spid/Cie Service Provider Config.
export const serviceProviderConfig: IServiceProviderConfig = {
  IDPMetadataUrl: IDP_METADATA_URL,
  organization: {
    URL: "https://io.italia.it",
    displayName: "IO - l'app dei servizi pubblici BETA",
    name: "PagoPA S.p.A.",
  },
  publicCert: SAML_CERT,
  requiredAttributes: {
    attributes: ["email", "name", "familyName", "fiscalNumber", "dateOfBirth"],
    name: "IO - l'app dei servizi pubblici BETA",
  },
  spidCieTestUrl: CIE_TEST_METADATA_URL,
  spidCieUrl: CIE_METADATA_URL,
  spidTestEnvUrl: SPID_TESTENV_URL,
  spidValidatorUrl: process.env.SPID_VALIDATOR_URL,
  strictResponseValidation: {
    ...(O.isSome(maybeSpidTestenvOption) ? maybeSpidTestenvOption.value : {}),
    ...(O.isSome(maybeSpidValidatorUrlOption)
      ? maybeSpidValidatorUrlOption.value
      : {}),
  },
};

// Private key used in SAML authentication to a SPID IDP.
export const SAML_KEY = pipe(
  process.env.SAML_KEY,
  O.fromNullable,
  O.getOrElse(() =>
    readFile(
      process.env.SAML_KEY_PATH || "./certs/key.pem",
      "SAML private key",
    ),
  ),
);

export const samlConfig: SamlConfig = {
  RACComparison: "minimum",
  acceptedClockSkewMs: SAML_ACCEPTED_CLOCK_SKEW_MS,
  attributeConsumingServiceIndex: SAML_ATTRIBUTE_CONSUMING_SERVICE_INDEX,
  // this value is dynamic and taken from query string
  authnContext: "https://www.spid.gov.it/SpidL1",
  // NOTE: the SPID endpoints are exposed with `api/auth/v1/` base path
  // but due to issues with metadata changes the metadata exposes
  // only `assertionConsumerService`. Therefore to spid-commons we pass the
  // entire URL to be exposed but the SAML_CALLBACK type of variables still
  // maps without `api/auth/v1` base path.
  callbackUrl: SAML_CALLBACK_URL,
  identifierFormat: "urn:oasis:names:tc:SAML:2.0:nameid-format:transient",
  issuer: SAML_ISSUER,
  logoutCallbackUrl: SAML_LOGOUT_CALLBACK_URL,
  privateCert: SAML_KEY,
  requestIdExpirationPeriodMs: SAML_REQUEST_EXPIRATION_PERIOD_MS,
};

// Set default idp metadata refresh time to 7 days
export const DEFAULT_IDP_METADATA_REFRESH_INTERVAL_SECONDS = 3600 * 24 * 7;
export const IDP_METADATA_REFRESH_INTERVAL_SECONDS: number = process.env
  .IDP_METADATA_REFRESH_INTERVAL_SECONDS
  ? parseInt(process.env.IDP_METADATA_REFRESH_INTERVAL_SECONDS, 10)
  : DEFAULT_IDP_METADATA_REFRESH_INTERVAL_SECONDS;

export const ClientErrorRedirectionUrlParams = t.union([
  t.intersection([
    t.interface({
      errorMessage: NonEmptyString,
    }),
    t.partial({
      errorCode: t.number,
    }),
  ]),
  t.intersection([
    t.partial({
      errorMessage: NonEmptyString,
    }),
    t.interface({
      errorCode: t.number,
    }),
  ]),
  t.interface({
    errorCode: t.number,
    errorMessage: NonEmptyString,
  }),
]);
export type ClientErrorRedirectionUrlParams = t.TypeOf<
  typeof ClientErrorRedirectionUrlParams
>;

export const getClientErrorRedirectionUrl = (
  params: ClientErrorRedirectionUrlParams,
): UrlFromString =>
  pipe(
    record
      .collect(S.Ord)((key, value) => `${key}=${value}`)(params)
      .join("&"),
    (errorParams) => CLIENT_ERROR_REDIRECTION_URL.concat(`?${errorParams}`),
    UrlFromString.decode,
    E.getOrElseW(() => {
      throw new Error("Invalid url");
    }),
  );

export const ALLOWED_CIE_TEST_FISCAL_CODES = pipe(
  process.env.ALLOWED_CIE_TEST_FISCAL_CODES,
  NonEmptyString.decode,
  E.chain(CommaSeparatedListOf(FiscalCode).decode),
  E.getOrElseW((errs) => {
    log.warn(
      `Missing or invalid ALLOWED_CIE_TEST_FISCAL_CODES environment variable: ${readableReport(
        errs,
      )}`,
    );

    return [] as ReadonlyArray<FiscalCode>;
  }),
);
