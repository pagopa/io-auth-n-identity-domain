import { readableReportSimplified } from "@pagopa/ts-commons/lib/reporters";
import * as E from "fp-ts/Either";
import * as TE from "fp-ts/TaskEither";
import { pipe } from "fp-ts/lib/function";
import { getIdpFriendlyNamesUrl } from "../config/idp-friendly-names";
import { OidcConfigurationEnv } from "../generated/backend/OidcConfigurationEnv";
import { STRINGS_RECORD } from "../types/common";

export type IdpFriendlyNameList = STRINGS_RECORD;

/**
 * Fetches and decodes the IDP friendly-name map for `env`.
 * No caching: callers own TTL, last-known-good, and in-flight coalescing.
 */
export const fetchIdpFriendlyNameList = (
  env: OidcConfigurationEnv,
  fetchApi: typeof fetch,
): TE.TaskEither<Error, IdpFriendlyNameList> => {
  return TE.tryCatch(async () => {
    const friendlyNamesUrlResult = getIdpFriendlyNamesUrl(env);
    if (E.isLeft(friendlyNamesUrlResult)) {
      throw friendlyNamesUrlResult.left;
    }
    const friendlyNamesUrlValue = friendlyNamesUrlResult.right;

    const response = await fetchApi(friendlyNamesUrlValue.href);
    if (!response.ok) {
      throw new Error(
        `IDP friendly names request failed for "${env}" with status ${response.status}`,
      );
    }
    const body: unknown = await response.json();
    const decoded = STRINGS_RECORD.decode(body);
    if (E.isLeft(decoded)) {
      throw new Error(
        `Invalid IDP friendly names payload for "${env}": ${readableReportSimplified(decoded.left)}`,
      );
    }
    return decoded.right;
  }, E.toError);
};
