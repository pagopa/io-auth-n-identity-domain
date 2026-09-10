import { readableReportSimplified } from "@pagopa/ts-commons/lib/reporters";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/lib/function";
import { IDP_FRIENDLY_NAMES_URLS } from "../config/idp-friendly-names";
import { OidcConfigurationEnv } from "../generated/backend/OidcConfigurationEnv";
import { STRINGS_RECORD } from "../types/common";

export type IdpFriendlyNameList = STRINGS_RECORD;

/**
 * Fetches and decodes the IDP friendly-name map for `env`.
 * No caching: callers own TTL, last-known-good, and in-flight coalescing.
 */
export const fetchIdpFriendlyNameList = async (
  env: OidcConfigurationEnv,
  fetchApi: typeof fetch,
): Promise<E.Either<Error, IdpFriendlyNameList>> => {
  try {
    const response = await fetchApi(IDP_FRIENDLY_NAMES_URLS[env]);
    if (!response.ok) {
      return E.left(
        new Error(
          `IDP friendly names request failed for "${env}" with status ${response.status}`,
        ),
      );
    }
    const body: unknown = await response.json();
    return pipe(
      STRINGS_RECORD.decode(body),
      E.mapLeft(
        (errors) =>
          new Error(
            `Invalid IDP friendly names payload for "${env}": ${readableReportSimplified(errors)}`,
          ),
      ),
    );
  } catch (error) {
    return E.left(E.toError(error));
  }
};
