import { GenericError, type NonEmptyString } from "@pagopa/hexagonal-core";
import type {
  HealthCheckOutboundPort,
  LollipopAssertionRef,
} from "@pagopa/io-auth-n-identity-domain";
import { DOMParser } from "@xmldom/xmldom";
import { err, ok, type Result } from "neverthrow";

import type { IdentityAssertionFetcherPort } from "../../domain/ports/outbound/identity-assertion-fetcher.port.js";
import type { IdentityAssertion } from "../../domain/value-objects/assertion.vo.js";
import type { OidcEnvironment } from "../../domain/value-objects/oidc.vo.js";
import { createClient } from "../../generated/one-identity/client/index.js";
import {
  getRequestHealthCheck as getRequestHealthCheckFromSdk,
  getSamlAssertion as getSamlAssertionFromSdk,
} from "../../generated/one-identity/index.js";

type OneIdIdentityAssertionFetcherAdapterConfig = {
  ONEID_PROD_ISSUER: URL;
  ONEID_UAT_ISSUER?: URL;
};

export class OneIdIdentityAssertionFetcherAdapter
  implements IdentityAssertionFetcherPort, HealthCheckOutboundPort
{
  private readonly configByEnv: Partial<
    Record<OidcEnvironment, { baseUrl: URL }>
  >;
  private readonly client: ReturnType<typeof createClient>;

  constructor(config: OneIdIdentityAssertionFetcherAdapterConfig) {
    this.configByEnv = {
      PROD: { baseUrl: config.ONEID_PROD_ISSUER },
      ...(config.ONEID_UAT_ISSUER
        ? { UAT: { baseUrl: config.ONEID_UAT_ISSUER } }
        : {}),
    };
    this.client = createClient();
  }
  async healthcheck(): Promise<Result<void, GenericError>> {
    const config = this.configByEnv.PROD;
    if (!config) {
      return err(
        new GenericError('Missing OIDC configuration for environment "PROD"'),
      );
    }

    try {
      const result = await getRequestHealthCheckFromSdk({
        client: this.client,
        baseUrl: config.baseUrl.href,
        parseAs: "text",
      });
      const status = result.response?.status;
      if (status === undefined || status < 200 || status >= 300) {
        return err(
          new GenericError(
            `One Identity status check failed, status: ${status ?? "unknown"}`,
          ),
        );
      }
      return ok(undefined);
    } catch (error) {
      return err(
        new GenericError(
          `One Identity status check failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        ),
      );
    }
  }

  async getAssertion(
    env: OidcEnvironment,
    accessToken: NonEmptyString,
  ): Promise<Result<IdentityAssertion, GenericError>> {
    const config = this.configByEnv[env];
    if (!config) {
      return err(
        new GenericError(`Missing OIDC configuration for environment "${env}"`),
      );
    }
    try {
      const result = await getSamlAssertionFromSdk({
        client: this.client,
        baseUrl: config.baseUrl.href,
        query: { access_token: accessToken },
        headers: {
          Accept: "application/xml",
        },
      });

      if (result.response?.status !== 200 || result.data === undefined) {
        return err(
          new GenericError(
            `Failed to get SAML assertion, status: ${result.response?.status ?? "unknown"}`,
          ),
        );
      }

      const rawAssertion = await result.data.text();
      const parserErrors: string[] = [];
      const parser = new DOMParser({
        errorHandler: {
          warning: (message) => parserErrors.push(String(message)),
          error: (message) => parserErrors.push(String(message)),
          fatalError: (message) => parserErrors.push(String(message)),
        },
      });
      const parsedAssertion = parser.parseFromString(
        rawAssertion,
        "application/xml",
      );

      if (!parsedAssertion?.documentElement) {
        return err(
          new GenericError("SAML assertion document has no root element"),
        );
      }

      if (parserErrors.length > 0) {
        return err(
          new GenericError(
            `Failed to parse SAML assertion: ${parserErrors.join("; ")}`,
          ),
        );
      }

      // TODO: add syntactic validation and extraction of assertion reference from the parsed assertion

      return ok({
        assertion: parsedAssertion,
        rawAssertion: rawAssertion as NonEmptyString, // if parsing succeeds, this should always be a non-empty string
        assertionRef: "" as LollipopAssertionRef, // FIXME: Replace with actual assertion reference once available
        type: "SAML", // The type of the assertion, currently hardcoded as SAML because is the only supported type at the moment
      });
    } catch (error) {
      return err(
        new GenericError(
          `Failed to get SAML assertion: ${
            error instanceof Error ? error.message : String(error)
          }`,
        ),
      );
    }
  }
}
