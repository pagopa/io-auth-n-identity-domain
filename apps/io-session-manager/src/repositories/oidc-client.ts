import type * as client from "openid-client" with { "resolution-mode": "import" };
import { OidcEnvConfig } from "../config/one-id";
import { OidcConfigurationEnv } from "../types/oidc";

/**
 * Per-environment in-memory cache of the discovered `openid-client` {@link
 * client.Configuration}. Discovery (provider metadata + JWKS) is an
 * expensive network round-trip, so the result is discovered once per
 * environment and shared across every subsequent request.
 *
 * A failed discovery is evicted so the next call can retry.
 */
const discoveryByEnv = new Map<
  OidcConfigurationEnv,
  Promise<client.Configuration>
>();

/**
 * Returns the cached OIDC `Configuration` for `env`, discovering it lazily
 * on first use.
 *
 * NOTE: `openid-client` v6 ships as an ECMAScript module only: since this app is
 * built as CommonJS, it's loaded through a dynamic `import()` rather than a
 * static one.
 *
 * @param env the OneIdentity configuration environment (PROD/UAT)
 * @param envConfig the resolved OIDC configuration for `env`
 * @param httpTimeoutSeconds timeout (seconds) applied to the discovery
 *   request towards the OIDC provider, preventing slow upstream responses
 *   from exhausting connections under load.
 */
export const getOidcConfiguration = (
  env: OidcConfigurationEnv,
  envConfig: OidcEnvConfig,
  httpTimeoutSeconds: number,
): Promise<client.Configuration> => {
  const cached = discoveryByEnv.get(env);
  if (cached) {
    return cached;
  }

  const discoveryPromise = (async () => {
    const { discovery, ClientSecretBasic, customFetch } = await import(
      "openid-client"
    );
    return discovery(
      new URL(envConfig.issuer.href),
      envConfig.clientId,
      { client_secret: envConfig.clientSecret },
      ClientSecretBasic(envConfig.clientSecret),
      {
        [customFetch as any]: sanitizingFetch,
        timeout: httpTimeoutSeconds,
      },
    );
  })().catch((error: unknown) => {
    // Evict the failed discovery so the next request can retry.
    discoveryByEnv.delete(env);
    throw error;
  });

  discoveryByEnv.set(env, discoveryPromise);
  return discoveryPromise;
};

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
