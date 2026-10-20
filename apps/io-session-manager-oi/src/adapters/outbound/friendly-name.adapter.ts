import { GenericError } from "@pagopa/hexagonal-core";
import { err, ok, Result } from "neverthrow";
import { IdpFriendlyNamePort } from "../../domain/ports/outbound/friendly-name.port.js";
import { OidcEnvironment } from "../../domain/value-objects/oidc.vo.js";
import z from "zod";
import { HttpUrlCodec } from "../../utils/codec/url.js";
import { NonEmptyString } from "@pagopa/hexagonal-core";

export const IdpFriendlyNameConfigSchema = z.object({
  IDP_FRIENDLY_NAMES_PROD_URL: HttpUrlCodec,
  IDP_FRIENDLY_NAMES_UAT_URL: HttpUrlCodec,
  IDP_FRIENDLY_NAMES_CACHE_TTL_SECONDS: z.coerce.number().int().positive(),
});

type CacheIdpFriendlyNames = {
    map: Record<string, string>;
    lastUpdated: number;
}

type IdpFriendlyNameConfig = z.output<
  typeof IdpFriendlyNameConfigSchema
>;

const FriendlyNamesSchema = z.record(
  z.string(),
  z.string(),
);
``
export class IdpFriendlyNameAdapter implements IdpFriendlyNamePort {
  private readonly urlsByEnv: Record<OidcEnvironment, URL | undefined>;
  private readonly cacheTtlSeconds: number;
  private cache: CacheIdpFriendlyNames;

  constructor(config: IdpFriendlyNameConfig) {
    this.urlsByEnv = {
      PROD: config.IDP_FRIENDLY_NAMES_PROD_URL,
      UAT: config.IDP_FRIENDLY_NAMES_UAT_URL,
    };
    this.cacheTtlSeconds = config.IDP_FRIENDLY_NAMES_CACHE_TTL_SECONDS 
    this.cache = {
      map: {},
      lastUpdated: 0,
    };
  }

  private getUrl(env: OidcEnvironment): URL | undefined {
    return this.urlsByEnv[env];
  }

  async getFriendlyName(issuer: string, env: OidcEnvironment): Promise<NonEmptyString> {
    const currentTimestamp = Date.now();
    if (currentTimestamp - this.cache.lastUpdated < this.cacheTtlSeconds * 1000) {
      return (this.cache.map[issuer] ?? issuer) as NonEmptyString;
    }
    const url = this.getUrl(env);
    if (!url) {
      return issuer as NonEmptyString;
    }

    const response = await fetch(url);

    if (!response.ok) {
        return issuer as NonEmptyString;
    }

    const body = await response.json();
    const map = FriendlyNamesSchema.parse(body)

    this.cache = {
      map,
      lastUpdated: currentTimestamp,
    };
    
    return (map[issuer] ?? issuer) as NonEmptyString
  }
}

