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
abstract class HeaderTokenTransportStrategy implements TokenTransportStrategy {
  constructor() {}

  /**
   * Extracts the authorization token from the specified HTTP header.
   * @param payload The HTTP request payload containing the authorization token.
   * @returns A Result object containing the extracted token as a NonEmptyString, or an AuthenticationError if extraction fails.
   */
  extract(
    payload: Readonly<HttpRequestPayload>,
  ): Result<NonEmptyString, AuthenticationError> {
    const headerName = this.getHeaderName();
    const headers = payload.headers as
      | { [key in typeof headerName]?: string }
      | undefined;

    const rawHeaderValue = headers?.[headerName] ?? "";
    if (!rawHeaderValue) {
      return err(new AuthenticationError());
    }

    const strippedResult = this.stripScheme(rawHeaderValue as NonEmptyString);
    if (strippedResult.isErr()) {
      return err(new AuthenticationError());
    }
    const strippedHeaderValue = strippedResult.value;

    return ok(strippedHeaderValue);
  }

  private stripScheme(
    headerValue: NonEmptyString,
  ): Result<NonEmptyString, AuthenticationError> {
    const scheme = this.getScheme();
    if (!scheme) {
      return ok(headerValue);
    }

    const prefix = `${scheme} `;
    if (headerValue.startsWith(prefix) && headerValue.length > prefix.length) {
      return ok(headerValue.slice(prefix.length) as NonEmptyString);
    }

    return err(new AuthenticationError());
  }

  protected abstract getScheme(): HttpAuthenticationScheme | undefined;

  protected abstract getHeaderName(): NonEmptyString;
}

/**
 * Supported HTTP authentication schemes as defined in [RFC 7235](https://www.rfc-editor.org/info/rfc7235/).
 *
 * Extend the list of supported schemes as needed.
 * See the full list of registered HTTP authentication schemes at:
 * https://www.iana.org/assignments/http-authschemes.
 */
type HttpAuthenticationScheme = "Bearer" | "Basic";

export class BearerAuthorizationHeaderTokenTransportStrategy extends HeaderTokenTransportStrategy {
  protected getScheme(): HttpAuthenticationScheme | undefined {
    return "Bearer";
  }

  protected getHeaderName(): NonEmptyString {
    return "authorization" as NonEmptyString;
  }
}

/**
 * Abstract class for token transport strategies that extract the token from the body of the HTTP request.
 */
abstract class BodyTokenTransportStrategy implements TokenTransportStrategy {
  constructor() {}

  /**
   * Extracts the authorization token from the specified HTTP body field.
   * @param payload The HTTP request payload containing the authorization token.
   * @returns A Result object containing the parsed session ID and active token, or an AuthenticationError if extraction fails.
   */
  extract(
    payload: Readonly<HttpRequestPayload>,
  ): Result<NonEmptyString, AuthenticationError> {
    const bodyFieldName = this.getBodyFieldName();

    const body = payload.body as
      | { [key in typeof bodyFieldName]?: string }
      | undefined;
    const bodyValue = body?.[bodyFieldName] ?? "";
    if (!bodyValue) {
      return err(new AuthenticationError());
    }
    return ok(bodyValue as NonEmptyString);
  }

  protected abstract getBodyFieldName(): NonEmptyString;
}

/**
 * Zendesk token body token transport strategy.
 * Zendesk requires that the token has to be sent in the "user_token" field in the HTTP request body.
 */
export class ZendeskTokenTransportStrategy extends BodyTokenTransportStrategy {
  protected getBodyFieldName(): NonEmptyString {
    return "user_token" as NonEmptyString;
  }
}
