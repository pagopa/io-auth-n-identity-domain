import {
  FiscalCode,
  FiscalCodeSchema,
  GenericError,
  ValidationError,
  type NonEmptyString,
} from "@pagopa/hexagonal-core";
import {
  LollipopAssertionRef,
  LollipopAssertionRefSchema,
  type HealthCheckOutboundPort,
} from "@pagopa/io-auth-n-identity-domain";
import { DOMParser } from "@xmldom/xmldom";
import { SyntaxValidator } from "fast-xml-validator";
import { err, ok, type Result } from "neverthrow";

import type { IdentityAssertionFetcherPort } from "../../domain/ports/outbound/identity-assertion-fetcher.port.js";
import type { IdentityAssertion } from "../../domain/value-objects/assertion.vo.js";
import type { OidcEnvironment } from "../../domain/value-objects/oidc.vo.js";
import { createClient } from "../../generated/one-identity/client/index.js";
import {
  getRequestHealthCheck as getRequestHealthCheckFromSdk,
  getSamlAssertion as getSamlResponse,
} from "../../generated/one-identity/index.js";

type OneIdIdentityAssertionFetcherAdapterConfig = {
  ONEID_PROD_ISSUER: URL;
  ONEID_UAT_ISSUER?: URL;
};

const SAML_NAMESPACE = {
  ASSERTION: "urn:oasis:names:tc:SAML:2.0:assertion",
  PROTOCOL: "urn:oasis:names:tc:SAML:2.0:protocol",
};

export class OneIdIdentityAssertionFetcherAdapter
  implements IdentityAssertionFetcherPort, HealthCheckOutboundPort
{
  private readonly clientByEnv: Partial<
    Record<OidcEnvironment, ReturnType<typeof createClient>>
  >;

  constructor(config: OneIdIdentityAssertionFetcherAdapterConfig) {
    const prodClient = createClient({
      baseUrl: config.ONEID_PROD_ISSUER.href,
    });

    this.clientByEnv = {
      PROD: prodClient,
      ...(config.ONEID_UAT_ISSUER
        ? {
            UAT: createClient({
              baseUrl: config.ONEID_UAT_ISSUER.href,
            }),
          }
        : {}),
    };
  }
  async healthcheck(): Promise<Result<void, GenericError>> {
    const client = this.clientByEnv.PROD;
    if (!client) {
      return err(
        new GenericError('Missing OIDC configuration for environment "PROD"'),
      );
    }

    try {
      const result = await getRequestHealthCheckFromSdk({
        client,
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
  ): Promise<Result<IdentityAssertion, ValidationError | GenericError>> {
    /*********************************************************/
    /* Fetch the SAML Response from the One Identity service */
    /*********************************************************/
    const client = this.clientByEnv[env];
    if (!client) {
      return err(
        new GenericError(`Missing OIDC configuration for environment "${env}"`),
      );
    }
    try {
      const result = await getSamlResponse({
        client,
        query: { access_token: accessToken },
        headers: {
          Accept: "application/xml",
        },
        // `Content-type: "application/xml"` is auto-parsed as a Blob (also with native fetch); DOMParser (and the generated response type) needs the response body as text.
        parseAs: "text",
      });

      if (result.response?.status !== 200 || result.data === undefined) {
        return err(
          new GenericError(
            `Failed to get SAML response, status: ${result.response?.status ?? "unknown"}`,
          ),
        );
      }
      const rawSamlResponse = result.data;

      /********************************************************/
      /* Syntactic validation of the raw SAML response as XML */
      /********************************************************/
      try {
        SyntaxValidator.validate(rawSamlResponse, {
          allowBooleanAttributes: false,
          multipleRoots: false,
        });
      } catch (error) {
        return err(
          new ValidationError(
            `Invalid XML in SAML response: ${
              error instanceof Error ? error.message : String(error)
            }`,
          ),
        );
      }

      /****************************************************/
      /* Parsing the raw SAML response as an XML document */
      /****************************************************/
      const parserErrors: string[] = [];
      const parser = new DOMParser({
        errorHandler: {
          warning: (message) => parserErrors.push(String(message)),
          error: (message) => parserErrors.push(String(message)),
          fatalError: (message) => parserErrors.push(String(message)),
        },
      });
      const parsedSamlResponse = parser.parseFromString(
        rawSamlResponse,
        "application/xml",
      );
      if (!parsedSamlResponse?.documentElement) {
        return err(
          new ValidationError("SAML response document has no root element"),
        );
      }
      if (parserErrors.length > 0) {
        return err(
          new ValidationError(
            `Failed to parse SAML response: ${parserErrors.join("; ")}`,
          ),
        );
      }

      const assertionResult =
        OneIdIdentityAssertionFetcherAdapter.extractAssertion(
          parsedSamlResponse,
        );
      if (assertionResult.isErr()) {
        return err(
          new ValidationError(
            `Could not extract authentication assertion from the SAML response: ${assertionResult.error.message}`,
          ),
        );
      }
      const assertion = assertionResult.value;

      const assertionRefResult =
        OneIdIdentityAssertionFetcherAdapter.extractAssertionRef(assertion);
      if (assertionRefResult.isErr()) {
        return err(
          new ValidationError(
            `Could not extract assertion reference from the SAML assertion: ${assertionRefResult.error.message}`,
          ),
        );
      }
      if (
        assertionRefResult.value !==
        parsedSamlResponse.documentElement.getAttribute("InResponseTo")
      ) {
        return err(
          new ValidationError(
            "SubjectConfirmationData InResponseTo does not match Response InResponseTo",
          ),
        );
      }

      const fiscalNumberResult =
        OneIdIdentityAssertionFetcherAdapter.extractFiscalCode(assertion);
      if (fiscalNumberResult.isErr()) {
        return err(
          new ValidationError(
            `Could not extract fiscal code from the SAML assertion: ${fiscalNumberResult.error.message}`,
          ),
        );
      }

      return ok({
        assertion: parsedSamlResponse,
        rawAssertion: rawSamlResponse as NonEmptyString, // if parsing succeeds, this should always be a non-empty string
        assertionRef: assertionRefResult.value,
        type: "SAML", // The type of the assertion, currently hardcoded as SAML because is the only supported type at the moment
        claims: {
          fiscalCode: fiscalNumberResult.value,
        },
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

  private static getSamlChildren(
    parent: Element,
    localName: string,
  ): Element[] {
    return Array.from(parent.childNodes).filter(
      (node): node is Element =>
        node.nodeType === 1 &&
        (node as Element).namespaceURI === SAML_NAMESPACE.ASSERTION &&
        (node as Element).localName === localName,
    );
  }

  private static getRequiredSamlChild(
    parent: Element,
    localName: string,
  ): Result<Element, ValidationError> {
    const children = OneIdIdentityAssertionFetcherAdapter.getSamlChildren(
      parent,
      localName,
    );
    if (children.length !== 1) {
      return err(
        new ValidationError(
          `Expected exactly one ${localName} element under ${parent.localName}, but found ${children.length}`,
        ),
      );
    }
    return ok(children[0]);
  }

  private static extractAssertion(
    samlResponse: Document,
  ): Result<Element, ValidationError> {
    const response = samlResponse.documentElement;
    if (
      response.namespaceURI !== SAML_NAMESPACE.PROTOCOL ||
      response.localName !== "Response"
    ) {
      return err(new ValidationError("Expected a SAML Response root element"));
    }
    return OneIdIdentityAssertionFetcherAdapter.getRequiredSamlChild(
      response,
      "Assertion",
    );
  }

  private static extractAssertionRef(
    assertion: Element,
  ): Result<LollipopAssertionRef, ValidationError> {
    let subjectConfirmationData = assertion;
    for (const localName of [
      "Subject",
      "SubjectConfirmation",
      "SubjectConfirmationData",
    ]) {
      const childResult =
        OneIdIdentityAssertionFetcherAdapter.getRequiredSamlChild(
          subjectConfirmationData,
          localName,
        );
      if (childResult.isErr()) {
        return err(childResult.error);
      }
      subjectConfirmationData = childResult.value;
    }
    const parsedAssertionRef = LollipopAssertionRefSchema.safeParse(
      subjectConfirmationData.getAttribute("InResponseTo"),
    );
    if (!parsedAssertionRef.success) {
      return err(
        new ValidationError(
          `Invalid SubjectConfirmationData InResponseTo: ${parsedAssertionRef.error.message}`,
        ),
      );
    }
    return ok(parsedAssertionRef.data);
  }

  private static extractFiscalCode(
    assertion: Element,
  ): Result<FiscalCode, ValidationError> {
    const statementResult =
      OneIdIdentityAssertionFetcherAdapter.getRequiredSamlChild(
        assertion,
        "AttributeStatement",
      );
    if (statementResult.isErr()) {
      return err(statementResult.error);
    }
    const fiscalNumberAttributes =
      OneIdIdentityAssertionFetcherAdapter.getSamlChildren(
        statementResult.value,
        "Attribute",
      ).filter(
        (attribute) => attribute.getAttribute("Name") === "fiscalNumber",
      );
    if (fiscalNumberAttributes.length !== 1) {
      return err(
        new ValidationError(
          `Expected exactly one fiscalNumber attribute, but found ${fiscalNumberAttributes.length}`,
        ),
      );
    }
    const valueResult =
      OneIdIdentityAssertionFetcherAdapter.getRequiredSamlChild(
        fiscalNumberAttributes[0],
        "AttributeValue",
      );
    if (valueResult.isErr()) {
      return err(valueResult.error);
    }
    if (
      Array.from(valueResult.value.childNodes).some(
        (node) => node.nodeType === 1,
      )
    ) {
      return err(
        new ValidationError("Expected a scalar text value for fiscalNumber"),
      );
    }
    const rawFiscalCode = valueResult.value.textContent
      ?.trim()
      .toUpperCase()
      .replace("TINIT-", "");
    const parsedFiscalCode = FiscalCodeSchema.safeParse(rawFiscalCode);
    if (parsedFiscalCode.success) {
      return ok(parsedFiscalCode.data);
    }
    return err(
      new ValidationError(
        `Invalid fiscal code: ${parsedFiscalCode.error.message}`,
      ),
    );
  }
}
