import {
  AuthenticationError,
  type NonEmptyString,
} from "@pagopa/hexagonal-core";
import type { HttpRequestPayload } from "@pagopa/hexagonal-core";
import { err, ok } from "neverthrow";
import type { Result } from "neverthrow";

/**
 * This interface defines the contract for token transport strategies that extract authorization tokens from HTTP requests.
 */
export interface TokenTransportStrategy {
  /**
   * Extracts the raw authorization token from the HTTP request.
   * @param payload The HTTP request payload containing the authorization token.
   * @returns A Result object containing the extracted raw token as a NonEmptyString, or an AuthenticationError if extraction fails.
   */
  extract(
    payload: Readonly<HttpRequestPayload>,
  ): Result<NonEmptyString, AuthenticationError>;
}

/**
 * Abstract class for token transport strategies that extract the token from HTTP headers.
 *
 * Subclasses should specify the header name and implement any scheme-specific logic if needed.
 * Provides a base implementation for extracting tokens from HTTP headers in the method `extract`.
 */
export abstract class HeaderTokenTransportStrategy
  implements TokenTransportStrategy
{
  constructor(private readonly headerName: NonEmptyString) {}

  /**
   * Extracts the authorization token from the specified HTTP header.
   * @param payload The HTTP request payload containing the authorization token.
   * @returns A Result object containing the extracted token as a NonEmptyString, or an AuthenticationError if extraction fails.
   */
  extract(
    payload: Readonly<HttpRequestPayload>,
  ): Result<NonEmptyString, AuthenticationError> {
    const headers = payload.headers as
      | { [key in typeof this.headerName]?: string }
      | undefined;
    const headerValue = headers?.[this.headerName] ?? "";
    if (!headerValue) {
      return err(new AuthenticationError());
    }
    return ok(headerValue as NonEmptyString);
  }
}

/**
 * Supported HTTP authentication schemes as defined in [RFC 7235](https://www.rfc-editor.org/info/rfc7235/).
 *
 * Extend the list of supported schemes as needed.
 * See the full list of registered HTTP authentication schemes at:
 * https://www.iana.org/assignments/http-authschemes.
 */
type HttpAuthenticationScheme = "Bearer" | "Basic";

/**
 * Authorization header token transport strategy that extracts the token from the "Authorization" header.
 * This strategy handles the extraction of tokens from the "Authorization" header, optionally stripping the specified authentication scheme.
 * The stripping is left optional and controlled by the `scheme` parameter in the constructor to allow flexibility for non-standard authentications.
 */
export class AuthorizationHeaderTokenTransportStrategy extends HeaderTokenTransportStrategy {
  constructor(private readonly scheme?: HttpAuthenticationScheme) {
    super("authorization" as NonEmptyString);
  }

  private stripScheme(
    headerValue: NonEmptyString,
  ): Result<NonEmptyString, AuthenticationError> {
    if (!this.scheme) {
      return ok(headerValue);
    }
    const prefix = `${this.scheme} `;
    if (headerValue.startsWith(prefix) && headerValue.length > prefix.length) {
      return ok(headerValue.slice(prefix.length) as NonEmptyString);
    }

    return err(new AuthenticationError());
  }

  override extract(
    payload: Readonly<HttpRequestPayload>,
  ): Result<NonEmptyString, AuthenticationError> {
    const result = super.extract(payload);
    if (result.isErr()) {
      return result;
    }
    const headerValue = result.value;

    const strippedResult = this.stripScheme(headerValue);
    if (strippedResult.isErr()) {
      return strippedResult;
    }

    return ok(strippedResult.value);
  }
}

export class BearerAuthorizationHeaderTokenTransportStrategy extends AuthorizationHeaderTokenTransportStrategy {
  constructor() {
    super("Bearer");
  }
}

/**
 * Abstract class for token transport strategies that extract the token from the body of the HTTP request.
 */
export abstract class BodyTokenTransportStrategy
  implements TokenTransportStrategy
{
  constructor(private readonly bodyFieldName: NonEmptyString) {}

  /**
   * Extracts the authorization token from the specified HTTP body field.
   * @param payload The HTTP request payload containing the authorization token.
   * @returns A Result object containing the parsed session ID and active token, or an AuthenticationError if extraction fails.
   */
  extract(
    payload: Readonly<HttpRequestPayload>,
  ): Result<NonEmptyString, AuthenticationError> {
    const body = payload.body as
      | { [key in typeof this.bodyFieldName]?: string }
      | undefined;
    const bodyValue = body?.[this.bodyFieldName] ?? "";
    if (!bodyValue) {
      return err(new AuthenticationError());
    }
    return ok(bodyValue as NonEmptyString);
  }
}

/**
 * User token body token transport strategy that extracts the token from the "user_token" field in the HTTP request body.
 */
export class UserTokenBodyTokenTransportStrategy extends BodyTokenTransportStrategy {
  constructor() {
    super("user_token" as NonEmptyString);
  }
}
