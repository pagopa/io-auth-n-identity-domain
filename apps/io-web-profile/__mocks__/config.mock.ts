import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { Second } from "@pagopa/ts-commons/lib/units";
import { generateKeyPairSync } from "crypto";
import { sign } from "jsonwebtoken";
import {
  FastLoginClientConfig,
  FunctionsAppClientConfig,
  HSLConfig,
  IConfig,
  JWTConfig
} from "../utils/config";
import { FeatureFlagEnum } from "../utils/featureFlags/featureFlags";

const aFiscalCode = "ISPXNB32R82Y766D";
const aName = "Carla";
const aFamilyName = "Rossi";
const auditLogConnectionString =
  "DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;BlobEndpoint=http://127.0.0.1:10000/devstoreaccount1;QueueEndpoint=http://127.0.0.1:10001/devstoreaccount1;TableEndpoint=http://127.0.0.1:10002/devstoreaccount1;";
const auditLogContainer = "logs";
const iconfig = {
  BETA_TESTERS: [aFiscalCode],
  FF_API_ENABLED: FeatureFlagEnum.ALL,
  isProduction: false,
  AUDIT_LOG_CONNECTION_STRING: auditLogConnectionString as NonEmptyString,
  AUDIT_LOG_CONTAINER: auditLogContainer as NonEmptyString
};

const {
  privateKey: hslPrivateKey,
  publicKey: hslPublicKey
} = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: {
    type: "spki",
    format: "pem"
  },
  privateKeyEncoding: {
    type: "pkcs8",
    format: "pem"
  }
});

const {
  privateKey: exchangePrivateKey,
  publicKey: exchangePublicKey
} = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: {
    type: "spki",
    format: "pem"
  },
  privateKeyEncoding: {
    type: "pkcs8",
    format: "pem"
  }
});

const {
  privateKey: magicLinkPrimaryPrivateKey,
  publicKey: magicLinkPrimaryPublicKey
} = generateKeyPairSync("ec", {
  namedCurve: "prime256v1",
  publicKeyEncoding: {
    type: "spki",
    format: "pem"
  },
  privateKeyEncoding: {
    type: "pkcs8",
    format: "pem"
  }
});
const {
  privateKey: magicLinkSecondaryPrivateKey,
  publicKey: magicLinkSecondaryPublicKey
} = generateKeyPairSync("ec", {
  namedCurve: "prime256v1",
  publicKeyEncoding: {
    type: "spki",
    format: "pem"
  },
  privateKeyEncoding: {
    type: "pkcs8",
    format: "pem"
  }
});

const hslIssuer = "SPID";
const exchangeIssuer = "pagopa";
const magicLinkIssuer = "pagopa";

const jwt = sign(
  {
    name: aName,
    family_name: aFamilyName,
    fiscal_number: aFiscalCode,
    jti: "AAA"
  },
  hslPrivateKey,
  { algorithm: "RS256", issuer: hslIssuer }
);

export const jwtConfig: JWTConfig = {
  BEARER_AUTH_HEADER: "authorization" as NonEmptyString,
  BLACKLISTED_JTI_LIST: [],
  HUB_SPID_LOGIN_JWT_ISSUER: hslIssuer as NonEmptyString,
  HUB_SPID_LOGIN_JWT_PUB_KEY: hslPublicKey as NonEmptyString,
  EXCHANGE_JWT_ISSUER: exchangeIssuer as NonEmptyString,
  EXCHANGE_JWT_PRIMARY_PRIVATE_KEY: exchangePrivateKey as NonEmptyString,
  EXCHANGE_JWT_PRIMARY_PUB_KEY: exchangePublicKey as NonEmptyString,
  EXCHANGE_JWT_SECONDARY_PUB_KEY: exchangePrivateKey as NonEmptyString,
  EXCHANGE_JWT_TTL: 900 as Second,
  MAGIC_LINK_JWE_ISSUER: magicLinkIssuer as NonEmptyString,
  MAGIC_LINK_JWE_PRIMARY_PRIVATE_KEY: magicLinkPrimaryPrivateKey as NonEmptyString,
  MAGIC_LINK_JWE_SECONDARY_PRIVATE_KEY: magicLinkSecondaryPrivateKey as NonEmptyString,
  MAGIC_LINK_JWE_PRIMARY_PUB_KEY: magicLinkPrimaryPublicKey as NonEmptyString,
  MAGIC_LINK_JWE_SECONDARY_PUB_KEY: magicLinkSecondaryPublicKey as NonEmptyString,
  MAGIC_LINK_JWE_TTL: 604800 as Second,
  MAGIC_LINK_BASE_URL: "http://localhost:3000/it/magic-link" as NonEmptyString
};

export const hslConfig: HSLConfig = {
  HUB_SPID_LOGIN_MOCK_TOKEN: jwt as NonEmptyString,
  HUB_SPID_LOGIN_API_KEY: "hslApiKey" as NonEmptyString,
  HUB_SPID_LOGIN_CLIENT_BASE_URL: "http://localhost:9090" as NonEmptyString
};

export const fastLoginClientConfig: FastLoginClientConfig = {
  FAST_LOGIN_API_KEY: "fastLoginApiKey" as NonEmptyString,
  FAST_LOGIN_CLIENT_BASE_URL: "fastLoginClientBaseUrl" as NonEmptyString
};

export const functionsAppClientConfig: FunctionsAppClientConfig = {
  FUNCTIONS_APP_API_KEY: "functionsAppApiKey" as NonEmptyString,
  FUNCTIONS_APP_CLIENT_BASE_URL: "functionsAppClientBaseUrl" as NonEmptyString
};

export const config: IConfig = {
  ...iconfig,
  ...jwtConfig,
  ...hslConfig,
  ...fastLoginClientConfig,
  ...functionsAppClientConfig
};
