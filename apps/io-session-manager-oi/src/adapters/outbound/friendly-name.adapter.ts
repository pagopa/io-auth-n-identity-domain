import {
  NonEmptyStringSchema,
  type NonEmptyString,
} from "@pagopa/hexagonal-core";
import { err, ok, type Result } from "neverthrow";
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

type IdpFriendlyNameConfig = z.output<typeof IdpFriendlyNameConfigSchema>;

const FriendlyNamesSchema = z.record(z.string(), NonEmptyStringSchema);
type FriendlyNames = z.output<typeof FriendlyNamesSchema>;

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

type CacheIdpFriendlyNamesForEnv = {
  CacheMapIdpFriendlyNames: FriendlyNames;
  lastUpdated: number;
  env: OidcEnvironment;
};

const resolveFriendlyName = (
  cacheIdpFriendlyNamesForEnv: CacheIdpFriendlyNamesForEnv,
  issuer: NonEmptyString,
): Result<NonEmptyString, Error> =>
  Object.hasOwn(cacheIdpFriendlyNamesForEnv.CacheMapIdpFriendlyNames, issuer)
    ? ok(cacheIdpFriendlyNamesForEnv.CacheMapIdpFriendlyNames[issuer])
    : err(
        new Error(
          `Friendly name not found for issuer "${issuer}" in env "${cacheIdpFriendlyNamesForEnv.env}". Available issuers: ${Object.keys(cacheIdpFriendlyNamesForEnv.CacheMapIdpFriendlyNames).join(", ") || "none"}.`,
        ),
      );

export class IdpFriendlyNameAdapter implements IdpFriendlyNamePort {
  private readonly urlsByEnv: Record<OidcEnvironment, URL | undefined>;
  private readonly cacheTtlMilliSeconds: number;
  private readonly timeoutMilliFetchSeconds: number;
  private cacheFriendlyNames: Map<OidcEnvironment, CacheIdpFriendlyNamesForEnv>;

  constructor(config: IdpFriendlyNameConfig) {
    this.urlsByEnv = {
      PROD: config.IDP_FRIENDLY_NAMES_PROD_URL,
      UAT: config.IDP_FRIENDLY_NAMES_UAT_URL,
    };
    this.cacheTtlMilliSeconds =
      config.IDP_FRIENDLY_NAMES_CACHE_TTL_SECONDS * 1000;
    this.timeoutMilliFetchSeconds =
      config.IDP_FRIENDLY_NAMES_HTTP_TIMEOUT_SECONDS * 1000;
    this.cacheFriendlyNames = new Map();
  }

  private getUrl(env: OidcEnvironment): URL | undefined {
    return this.urlsByEnv[env];
  }

  async getFriendlyName(
    issuer: NonEmptyString,
    env: OidcEnvironment,
  ): Promise<Result<NonEmptyString, Error>> {
    const currentTimestamp = Date.now();
    const cachedValueByEnv = this.cacheFriendlyNames.get(env);
    if (
      cachedValueByEnv &&
      currentTimestamp - cachedValueByEnv.lastUpdated <
        this.cacheTtlMilliSeconds
    ) {
      return resolveFriendlyName(cachedValueByEnv, issuer);
    }

    const url = this.getUrl(env);
    if (!url) {
      return err(
        new Error(`Friendly names URL is not configured for env "${env}".`),
      );
    }

    let response: Response;
    try {
      response = await fetch(url, {
        signal: AbortSignal.timeout(this.timeoutMilliFetchSeconds),
      });
    } catch (error) {
      return err(
        new Error(
          `Friendly names request failed for env "${env}": ${getErrorMessage(error)}`,
        ),
      );
    }

    if (!response.ok) {
      const statusText = response.statusText ? ` ${response.statusText}` : "";
      return err(
        new Error(
          `Friendly names request for env "${env}" returned HTTP ${response.status}${statusText}.`,
        ),
      );
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch (error) {
      return err(
        new Error(
          `Failed to parse friendly names response as JSON for env "${env}": ${getErrorMessage(error)}`,
        ),
      );
    }

    let friendlyNamesMap: FriendlyNames;
    try {
      friendlyNamesMap = FriendlyNamesSchema.parse(body);
    } catch (error) {
      return err(
        new Error(
          `Invalid friendly names response for env "${env}": ${getErrorMessage(error)}`,
        ),
      );
    }

    this.cacheFriendlyNames.set(env, {
      CacheMapIdpFriendlyNames: friendlyNamesMap,
      lastUpdated: currentTimestamp,
      env,
    });

    return resolveFriendlyName(this.cacheFriendlyNames.get(env)!, issuer);
  }
}
