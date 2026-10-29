import {
  NonEmptyStringSchema,
  type NonEmptyString,
} from "@pagopa/hexagonal-core";
import { agent } from "@pagopa/ts-commons";
import {
  AbortableFetch,
  setFetchTimeout,
  toFetch,
} from "@pagopa/ts-commons/lib/fetch.js";
import type { Millisecond } from "@pagopa/ts-commons/lib/units.js";
import z from "zod";

import type { IdpFriendlyNamePort } from "../../domain/ports/outbound/friendly-name.port.js";
import type { OidcEnvironment } from "../../domain/value-objects/oidc.vo.js";
import { PositiveIntegerSchema } from "../../domain/value-objects/positive-integer.vo.js";
import { HttpUrlCodec } from "../../utils/codec/url.js";

export const IdpFriendlyNameConfigSchema = z.object({
  IDP_FRIENDLY_NAMES_PROD_URL: HttpUrlCodec,
  IDP_FRIENDLY_NAMES_UAT_URL: HttpUrlCodec,
  IDP_FRIENDLY_NAMES_CACHE_TTL_SECONDS: PositiveIntegerSchema,
  IDP_FRIENDLY_NAMES_HTTP_TIMEOUT_SECONDS: PositiveIntegerSchema,
});

type CacheIdpFriendlyNames = {
  map: Record<string, NonEmptyString>;
  lastUpdated: number;
};

type IdpFriendlyNameConfig = z.output<typeof IdpFriendlyNameConfigSchema>;

const FriendlyNamesSchema = z.record(z.string(), NonEmptyStringSchema);

const resolveFriendlyName = (
  map: Record<string, NonEmptyString>,
  issuer: NonEmptyString,
): NonEmptyString => (Object.hasOwn(map, issuer) ? map[issuer] : issuer);

export class IdpFriendlyNameAdapter implements IdpFriendlyNamePort {
  private readonly urlsByEnv: Record<OidcEnvironment, URL | undefined>;
  private readonly cacheTtlSeconds: number;
  private readonly fetchApi: typeof fetch;
  private cache: Map<OidcEnvironment, CacheIdpFriendlyNames>;

  constructor(config: IdpFriendlyNameConfig) {
    this.urlsByEnv = {
      PROD: config.IDP_FRIENDLY_NAMES_PROD_URL,
      UAT: config.IDP_FRIENDLY_NAMES_UAT_URL,
    };
    this.cacheTtlSeconds = config.IDP_FRIENDLY_NAMES_CACHE_TTL_SECONDS;
    const abortableFetch = AbortableFetch(agent.getFetch(process.env));
    const fetchWithTimeout = setFetchTimeout(
      (config.IDP_FRIENDLY_NAMES_HTTP_TIMEOUT_SECONDS * 1000) as Millisecond,
      abortableFetch,
    );
    this.fetchApi = toFetch(fetchWithTimeout) as unknown as typeof fetch;
    this.cache = new Map();
  }

  private getUrl(env: OidcEnvironment): URL | undefined {
    return this.urlsByEnv[env];
  }

  async getFriendlyName(
    issuer: NonEmptyString,
    env: OidcEnvironment,
  ): Promise<NonEmptyString> {
    const currentTimestamp = Date.now();
    const cachedValue = this.cache.get(env);
    if (
      cachedValue &&
      currentTimestamp - cachedValue.lastUpdated < this.cacheTtlSeconds * 1000
    ) {
      return resolveFriendlyName(cachedValue.map, issuer);
    }

    const url = this.getUrl(env);
    if (!url) {
      return issuer;
    }

    try {
      const response = await this.fetchApi(url);

      if (!response.ok) {
        return issuer;
      }

      const body: unknown = await response.json();
      const map = FriendlyNamesSchema.parse(body);

      this.cache.set(env, {
        map,
        lastUpdated: currentTimestamp,
      });

      return resolveFriendlyName(map, issuer);
    } catch {
      return issuer;
    }
  }
}
