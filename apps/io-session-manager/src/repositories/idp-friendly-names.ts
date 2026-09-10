import {
  AbortableFetch,
  setFetchTimeout,
  toFetch,
} from "@pagopa/ts-commons/lib/fetch";
import { agent } from "@pagopa/ts-commons";
import { Millisecond } from "@pagopa/ts-commons/lib/units";
import * as E from "fp-ts/Either";
import * as T from "fp-ts/Task";
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

const makeResolveList = (deps: IdpFriendlyNamesDeps) => {
  const inFlightByEnv = new Map<
    OidcConfigurationEnv,
    Promise<IdpFriendlyNameList | undefined>
  >();

  return async (
    env: OidcConfigurationEnv,
  ): Promise<IdpFriendlyNameList | undefined> => {
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

    const promise = (async () => {
      const result = await fetchIdpFriendlyNameList(env, deps.fetchApi);
      if (E.isRight(result)) {
        deps.cache.set(env, { map: result.right, fetchedAt: deps.now() });
        return result.right;
      }

      if (cached) {
        log.warn(
          "Failed to fetch IDP friendly names for %s, using last-known-good | %s",
          env,
          result.left.message,
        );
        return cached.map;
      }

      log.error(
        "Failed to fetch IDP friendly names for %s | %s",
        env,
        result.left.message,
      );
      return undefined;
    })().finally(() => {
      inFlightByEnv.delete(env);
    });

    inFlightByEnv.set(env, promise);
    return promise;
  };
};

export const makeGetIdpFriendlyName = (
  deps: IdpFriendlyNamesDeps,
): GetIdpFriendlyName => {
  const resolveList = makeResolveList(deps);

  return (env, identifier) => async () => {
    const map = await resolveList(env);
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
