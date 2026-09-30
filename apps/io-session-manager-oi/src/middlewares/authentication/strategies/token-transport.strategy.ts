import {
  AuthenticationError,
  type NonEmptyString,
} from "@pagopa/hexagonal-core";
import type { HttpRequestPayload } from "@pagopa/hexagonal-core";
import { err, ok } from "neverthrow";
import type { Result } from "neverthrow";

export interface TokenTransportStrategy {
  /**
   * Extracts the authorization token to obtain the session ID and token.
   * @param payload The HTTP request payload containing the authorization token.
   * @returns A Result object containing the parsed session ID and active token, or an AuthenticationError if extraction fails.
   */
  extract(
    payload: Readonly<HttpRequestPayload>,
  ): Result<NonEmptyString, AuthenticationError>;
}

/**
 * Abstract class for token transport strategies that extract the token from HTTP headers.
 */
export abstract class HeaderTokenTransportStrategy
  implements TokenTransportStrategy
{
  constructor(private readonly headerName: NonEmptyString) {}

  /**
   * Extracts the authorization token from the specified HTTP header.
   * @param payload The HTTP request payload containing the authorization token.
   * @returns A Result object containing the parsed session ID and active token, or an AuthenticationError if extraction fails.
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
 * Authorization header token transport strategy that extracts the token from the "Authorization" header.
 */
export class AuthorizationHeaderTokenTransportStrategy extends HeaderTokenTransportStrategy {
  constructor() {
    super("Authorization" as NonEmptyString);
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
