import { AuthenticationError } from "@pagopa/hexagonal-core";
import {
  PlainBpdSSOTokenSchema,
  PlainFimsSSOTokenSchema,
  PlainSessionTokenSchema,
  PlainPagopaSSOTokenSchema,
  type SessionId,
  SessionIdSchema,
  ExtendedPlainZendeskSSOTokenSchema,
} from "@pagopa/io-auth-n-identity-session";
import { err, ok, type Result } from "neverthrow";
import z from "zod";

import type { AuthToken, TokenType } from "../auth-token.js";

/**
 * Interface for any parser that extracts session ID and session token from an authorization token.
 */
export interface TokenParsingStrategy<T extends TokenType> {
  /**
   * Parses the authorization token to extract the session ID and session token.
   * @param token The authorization token containing the session ID and session token.
   * @returns A Result object containing the parsed session ID and session token, or an AuthenticationError if parsing fails.
   */
  parse(token: string): Result<
    {
      sessionId: SessionId;
      sessionToken: AuthToken[T]["type"];
    },
    AuthenticationError
  >;
}

/**
 * Strategy for parsing authorization tokens.
 * This class uses a Zod schema to validate and extract the session ID and session token from the authorization token.
 */
abstract class AbstractTokenParsingStrategy<T extends TokenType>
  implements TokenParsingStrategy<T>
{
  private readonly bodyTokenSchema: ReturnType<
    (typeof AbstractTokenParsingStrategy)["createTokenSchema"]
  >;

  constructor(sessionTokenSchema: AuthToken[T]["schema"]) {
    this.bodyTokenSchema =
      AbstractTokenParsingStrategy.createTokenSchema(sessionTokenSchema);
  }

  parse(token: string): Result<
    {
      sessionId: SessionId;
      sessionToken: AuthToken[T]["type"];
    },
    AuthenticationError
  > {
    const parsedBearerToken = this.bodyTokenSchema.safeParse(token);

    if (!parsedBearerToken.success) {
      // TODO: log the underlying error for debugging purposes
      console.warn(parsedBearerToken.error.message);
      return err(new AuthenticationError());
    }

    const { sessionId, sessionToken } = parsedBearerToken.data;

    return ok({ sessionId, sessionToken });
  }

  /**
   * Creates a Zod schema for an authorization token containing a session ID and session token.
   * The authorization token must be in the format "<sessionId>.<sessionToken>".
   *
   * @param sessionTokenSchema The Zod schema to validate the session token.
   * @returns A Zod schema that validates the authorization token format and extracts the session ID and session token.
   */
  private static createTokenSchema<T extends TokenType>(
    sessionTokenSchema: AuthToken[T]["schema"],
  ) {
    return z
      .preprocess(
        (value, context) => {
          if (typeof value !== "string") {
            context.addIssue({
              code: "custom",
              message: "Invalid authorization body format",
            });
            return z.NEVER;
          }

          const separatorIndex = value.indexOf(".");
          if (
            separatorIndex <= 0 ||
            separatorIndex === value.length - 1 ||
            separatorIndex !== value.lastIndexOf(".")
          ) {
            context.addIssue({
              code: "custom",
              message: "Invalid authorization body format",
            });
            return z.NEVER;
          }

          const sessionId = value.slice(0, separatorIndex);
          const sessionToken = value.slice(separatorIndex + 1);
          return { sessionId, sessionToken };
        },
        z.object({
          sessionId: SessionIdSchema,
          sessionToken: sessionTokenSchema,
        }),
      )
      .meta({ type: "string" });
  }
}

export class SessionBearerTokenParsingStrategy extends AbstractTokenParsingStrategy<"session"> {
  constructor() {
    super(PlainSessionTokenSchema);
  }
}

export class BpdBearerTokenParsingStrategy extends AbstractTokenParsingStrategy<"bpd"> {
  constructor() {
    super(PlainBpdSSOTokenSchema);
  }
}

export class FimsBearerTokenParsingStrategy extends AbstractTokenParsingStrategy<"fims"> {
  constructor() {
    super(PlainFimsSSOTokenSchema);
  }
}

export class PagopaBearerTokenParsingStrategy extends AbstractTokenParsingStrategy<"pagopa"> {
  constructor() {
    super(PlainPagopaSSOTokenSchema);
  }
}

export class ZendeskTokenParsingStrategy extends AbstractTokenParsingStrategy<"zendesk"> {
  constructor() {
    super(ExtendedPlainZendeskSSOTokenSchema);
  }
}
