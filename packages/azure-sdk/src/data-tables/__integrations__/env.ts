import { NonEmptyString } from "@pagopa/hexagonal-core";

/**
 * Azurite Table endpoint. Overridable via env for CI or docker-compose runs.
 * Defaults match the port published by `docker-compose.yml` for the
 * `storage` service (`tablePort 20005`).
 */
export const AZURITE_TABLE_PORT = Number(
  process.env.AZURITE_TABLE_PORT ?? 20005,
);

export const AZURITE_ACCOUNT = "devstoreaccount1";

// Well-known Azurite emulator key — safe to hard-code.
export const AZURITE_KEY =
  "Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==";

export const AZURITE_TABLE_ENDPOINT =
  process.env.AZURITE_TABLE_ENDPOINT ??
  `http://127.0.0.1:${AZURITE_TABLE_PORT}/${AZURITE_ACCOUNT}`;

export const STORAGE_CONN_STRING = (`DefaultEndpointsProtocol=http;` +
  `AccountName=${AZURITE_ACCOUNT};` +
  `AccountKey=${AZURITE_KEY};` +
  `TableEndpoint=${AZURITE_TABLE_ENDPOINT};`) as NonEmptyString;
