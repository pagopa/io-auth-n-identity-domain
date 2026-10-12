import {
  AbortableFetch,
  setFetchTimeout,
  toFetch,
} from "@pagopa/ts-commons/lib/fetch";
import { agent } from "@pagopa/ts-commons";
import { Millisecond } from "@pagopa/ts-commons/lib/units";

import * as T from "fp-ts/Task";
import * as TE from "fp-ts/TaskEither";
import { pipe } from "fp-ts/function";

import {
  IDP_FRIENDLY_NAMES_CACHE_TTL_SECONDS,
  IDP_FRIENDLY_NAMES_HTTP_TIMEOUT_SECONDS,
} from "../config/idp-friendly-names";
import { OidcConfigurationEnv } from "../generated/backend/OidcConfigurationEnv";
import { log } from "../utils/logger";
import {
  fetchIdpFriendlyNameList,
  IdpFriendlyNameList,
} from "./idp-friendly-names-fetch";

type CacheEntry = {
  map: IdpFriendlyNameList;
  fetchedAt: number;
};

export type IdpFriendlyNamesDeps = {
  fetchApi: typeof fetch;
  now: () => number;
  cacheTtlSeconds: number;
  cache: Map<OidcConfigurationEnv, CacheEntry>;
};

const abortableFetch = AbortableFetch(agent.getFetch(process.env));
const fetchWithTimeout = setFetchTimeout(
  (IDP_FRIENDLY_NAMES_HTTP_TIMEOUT_SECONDS * 1000) as Millisecond,
  abortableFetch,
);

const defaultIdpFriendlyNamesDeps: IdpFriendlyNamesDeps = {
  fetchApi: toFetch(fetchWithTimeout) as unknown as typeof fetch,
  now: () => Date.now(),
  cacheTtlSeconds: IDP_FRIENDLY_NAMES_CACHE_TTL_SECONDS,
  cache: new Map<OidcConfigurationEnv, CacheEntry>(),
};

export type GetIdpFriendlyName = (
  env: OidcConfigurationEnv,
  identifier: string,
) => T.Task<string>;

/**
 * Handle single HTTP fetch with fallback to last-known-good.
 * Returns the fetched map if successful, otherwise falls back to the cached entry if available.
 */
const fetchAndHandleFallback = (
  env: OidcConfigurationEnv,
  deps: IdpFriendlyNamesDeps,
  cached?: CacheEntry,
): T.Task<IdpFriendlyNameList | undefined> =>
  pipe(
    fetchIdpFriendlyNameList(env, deps.fetchApi),
    TE.match(
      (error) => {
        if (cached) {
          log.warn(
            "Failed to fetch IDP friendly names for %s, using last-known-good | %s",
            env,
            error.message,
          );
          return cached.map;
        }

        log.error(
          "Failed to fetch IDP friendly names for %s | %s",
          env,
          error.message,
        );
        return undefined;
      },
      (map) => {
        deps.cache.set(env, { map, fetchedAt: deps.now() });
        return map;
      },
    ),
  );

const makeResolveList = (
  deps: IdpFriendlyNamesDeps,
): ((env: OidcConfigurationEnv) => T.Task<IdpFriendlyNameList | undefined>) => {
  const inFlightByEnv = new Map<
    OidcConfigurationEnv,
    Promise<IdpFriendlyNameList | undefined>
  >();

  return (env) => async () => {
    const cached = deps.cache.get(env);
    const isFresh =
      cached !== undefined &&
      deps.now() - cached.fetchedAt < deps.cacheTtlSeconds * 1000;

    if (isFresh) {
      return cached.map;
    }

    const inFlight = inFlightByEnv.get(env);
    if (inFlight) {
      return inFlight;
    }

    const fetchFriendlyNamePromise = fetchAndHandleFallback(
      env,
      deps,
      cached,
    )().finally(() => {
      inFlightByEnv.delete(env);
    });

    inFlightByEnv.set(env, fetchFriendlyNamePromise);
    return fetchFriendlyNamePromise;
  };
};

export const makeGetIdpFriendlyName = (
  deps: IdpFriendlyNamesDeps,
): GetIdpFriendlyName => {
  const resolveList = makeResolveList(deps);

  return (env, identifier) => async () => {
    const map = await resolveList(env)();
    return map?.[identifier] ?? "Sconosciuto";
  };
};

/**
 * Resolves the friendly name for `identifier`.
 * Missing keys, fetch failures without last-known-good, and unknown identifiers
 * fall back to "Sconosciuto", matching ACS `getSpidIdpFriendlyName`.
 */
export const getIdpFriendlyName = makeGetIdpFriendlyName(
  defaultIdpFriendlyNamesDeps,
);
