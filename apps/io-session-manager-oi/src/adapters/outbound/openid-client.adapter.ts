import { AuthenticationError, GenericError } from "@pagopa/hexagonal-core";
import { err, ok, type Result } from "neverthrow";
import * as client from "openid-client";

import {
  type OidcConfigPort,
  type OidcEnvConfig,
} from "../../domain/ports/outbound/oidc-config.port.js";
import {
  type OidcExchangeParamsDTO,
  type OidcClientPort,
} from "../../domain/ports/outbound/oidc.port.js";
import {
  type OidcClaims,
  OidcClaimsSchema,
} from "../../domain/value-objects/oidc-claims.vo.js";
import { type OidcConfigurationEnv } from "../../domain/value-objects/oidc.vo.js";

/**
 *
 * Adapter implementing {@link OidcClientPort} using the `openid-client`
 * library. Provider metadata is discovered lazily and cached per environment.
 */
export class OpenIdClientAdapter implements OidcClientPort {
  private readonly discoveryByEnv = new Map<
    OidcConfigurationEnv,
    Promise<client.Configuration>
  >();

  /**
   * @param oidcConfigPort provides per-environment OIDC configuration.
   * @param httpTimeoutSeconds timeout (seconds) applied to every HTTP request
   *   towards the OIDC provider (discovery, JWKS, token endpoint). Prevents
   *   slow upstream responses from exhausting connections under load.
   */
  constructor(
    private readonly oidcConfigPort: OidcConfigPort,
    private readonly httpTimeoutSeconds: number = 8,
  ) {}

  /**
   * Triggers OIDC discovery (provider metadata + JWKS) for the given
   * environments so the cost is paid at startup instead of on the first user
   * request of each replica.
   *
   * Best-effort by design: a provider outage at boot must not prevent the
   * container from starting (that would couple our availability to OneID and
   * block deploys/scale-out). Failures stay in the {@link resolveConfiguration}
   * Result and are discarded; the lazy path in {@link exchange} and
   * {@link getAuthorizationEndpoint} retries on the next request.
   */
  warmUp = async (envs: ReadonlySet<OidcConfigurationEnv>): Promise<void> => {
    await Promise.all([...envs].map((env) => this.resolveConfiguration(env)));
  };

  getAuthorizationEndpoint = async (
    env: OidcConfigurationEnv,
  ): Promise<Result<URL, GenericError>> => {
    const oidcConfigResult = await this.resolveConfiguration(env);
    if (oidcConfigResult.isErr()) {
      return err(oidcConfigResult.error);
    }

    const authorizationEndpoint =
      oidcConfigResult.value.serverMetadata().authorization_endpoint;
    if (!authorizationEndpoint) {
      return err(
        new GenericError(
          "OIDC discovery metadata is missing authorization_endpoint",
        ),
      );
    }

    try {
      return ok(new URL(authorizationEndpoint));
    } catch {
      return err(
        new GenericError(
          `Invalid authorization_endpoint from OIDC discovery: ${authorizationEndpoint}`,
        ),
      );
    }
  };

  exchange = async (
    params: OidcExchangeParamsDTO,
  ): Promise<Result<OidcClaims, AuthenticationError | GenericError>> => {
    const oidcConfigResult = await this.resolveConfiguration(params.env);
    if (oidcConfigResult.isErr()) {
      return err(oidcConfigResult.error);
    }
    const oidcConfig = oidcConfigResult.value;

    const envConfigResult = this.oidcConfigPort.getConfig(params.env);
    if (envConfigResult.isErr()) {
      return err(
        new GenericError(
          `Missing OIDC configuration: ${envConfigResult.error.message}`,
        ),
      );
    }
    const envConfig = envConfigResult.value;

    try {
      // Reconstruct the callback URL from the registered redirect URI so the
      // `redirect_uri` sent to the token endpoint matches the auth request,
      // even when the app runs behind a reverse proxy.
      const callbackUrl = new URL(envConfig.redirectUri.href);
      callbackUrl.search = new URLSearchParams({
        code: params.code,
        state: params.state,
      }).toString();

      const tokens = await client.authorizationCodeGrant(
        oidcConfig,
        callbackUrl,
        {
          expectedState: params.state,
          expectedNonce: params.expectedNonce,
          idTokenExpected: true,
        },
      );

      const rawClaims = tokens.claims();
      if (!rawClaims) {
        return err(new AuthenticationError());
      }

      const parsedClaims = OidcClaimsSchema.safeParse(rawClaims);
      if (!parsedClaims.success) {
        return err(new GenericError("Invalid OIDC claims"));
      }

      return ok(parsedClaims.data);
    } catch (error) {
      //TODO: Discriminate between invalid code/state/nonce
      // and other errors (network, provider outage, etc.) to return a more specific error type.
      return err(new AuthenticationError());
    }
  };

  /**
   * Resolves env config and discovered provider metadata, mapping failures to
   * {@link GenericError} so callers share the same error contract.
   */
  private resolveConfiguration = async (
    env: OidcConfigurationEnv,
  ): Promise<Result<client.Configuration, GenericError>> => {
    const envConfigResult = this.oidcConfigPort.getConfig(env);
    if (envConfigResult.isErr()) {
      return err(
        new GenericError(
          `Missing OIDC configuration: ${envConfigResult.error.message}`,
        ),
      );
    }

    try {
      return ok(await this.getConfiguration(env, envConfigResult.value));
    } catch (error) {
      return err(
        new GenericError(`OIDC discovery failed: ${toMessage(error)}`),
      );
    }
  };

  /**
   * Returns the cached {@link client.Configuration} for `env`, discovering it
   * lazily on first use. Concurrent callers share a single in-flight discovery,
   * and a failed discovery is evicted so the next call retries.
   */
  private getConfiguration(
    env: OidcConfigurationEnv,
    envConfig: OidcEnvConfig,
  ): Promise<client.Configuration> {
    let discoveryPromise = this.discoveryByEnv.get(env);
    if (!discoveryPromise) {
      discoveryPromise = client
        .discovery(
          envConfig.baseUrl,
          envConfig.clientId,
          { client_secret: envConfig.clientSecret },
          client.ClientSecretBasic(envConfig.clientSecret),
          {
            [client.customFetch as any]: sanitizingFetch,
            timeout: this.httpTimeoutSeconds,
          },
        )
        .catch((error: unknown) => {
          // Evict the failed discovery so the next request can retry.
          this.discoveryByEnv.delete(env);
          throw error;
        });
      this.discoveryByEnv.set(env, discoveryPromise);
    }
    return discoveryPromise;
  }
}

const toMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/**
 * Some OIDC providers return `null` for optional token fields such as
 * `refresh_token`/`access_token`/`id_token`. `openid-client` strictly rejects
 * non-string values, so this fetch wrapper drops every `null` field before the
 * library parses the token endpoint response.
 *
 * Only POST responses (the token endpoint) are inspected; discovery and JWKS
 * requests (GET) are forwarded untouched to avoid needless re-parsing.
 */
const sanitizingFetch = async (
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> => {
  const response = await fetch(input, init);
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;
  if (init?.method?.toUpperCase() !== "POST") return response;

  const body = await response.json();
  // The stream is already consumed, so rebuild instead of returning `response`.
  if (typeof body !== "object" || body === null) {
    return rebuildJsonResponse(JSON.stringify(body), response);
  }

  for (const field of ["refresh_token", "access_token", "id_token"]) {
    if (field in body && typeof body[field] !== "string") {
      // openid4webapi strictly rejects non string fields
      // if provider return non-string values such as null
      // it can be rejected
      delete body[field];
    }
  }

  return rebuildJsonResponse(JSON.stringify(body), response);
};

/**
 * Rebuilds a JSON `Response` from an already-consumed body, stripping headers
 * that no longer match the new payload (`content-length`) or describe an
 * encoding the body no longer has (`content-encoding`, since the runtime
 * `fetch` already decoded it). Keeping them would cause undici to fail with a
 * content-length/encoding mismatch.
 */
const rebuildJsonResponse = (body: string, source: Response): Response => {
  const headers = new Headers(source.headers);
  headers.delete("content-length");
  headers.delete("content-encoding");
  return new Response(body, {
    status: source.status,
    statusText: source.statusText,
    headers,
  });
};
