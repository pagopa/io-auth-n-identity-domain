import { AuthenticationError } from "@pagopa/hexagonal-core";
import {
  PlainBpdSSOTokenSchema,
  PlainSessionTokenSchema,
  type SessionId,
  SessionIdSchema,
} from "@pagopa/io-auth-n-identity-session";
import { err, ok, type Result } from "neverthrow";
import z from "zod";

import type { AuthToken, TokenType } from "../auth-token.js";

const BearerPrefix = "Bearer ";

/**
 * Interface for a parser that extracts session ID and token from a Bearer authorization header.
 */
export interface BearerTokenParsingStrategy<T extends TokenType> {
  /**
   * Parses the Bearer authorization header to extract the session ID and token.
   * @param bearerToken The Bearer authorization header containing the session ID and token.
   * @returns A Result object containing the parsed session ID and token, or an AuthenticationError if parsing fails.
   */
  parse(bearerToken: string): Result<
    {
      sessionId: SessionId;
      sessionToken: AuthToken[T]["type"];
    },
    AuthenticationError
  >;
}

/**
 * Strategy for parsing Bearer tokens from authorization headers.
 * This class uses a Zod schema to validate and extract the session ID and token from the header.
 */
export abstract class BearerTokenParsingBaseStrategy<T extends TokenType>
  implements BearerTokenParsingStrategy<T>
{
  private readonly bearerTokenSchema: ReturnType<
    (typeof BearerTokenParsingBaseStrategy)["createBearerTokenSchema"]
  >;

  constructor(sessionTokenSchema: AuthToken[T]["schema"]) {
    this.bearerTokenSchema =
      BearerTokenParsingBaseStrategy.createBearerTokenSchema(
        sessionTokenSchema,
      );
  }

  parse(bearerToken: string): Result<
    {
      sessionId: SessionId;
      sessionToken: AuthToken[T]["type"];
    },
    AuthenticationError
  > {
    const parsedBearerToken = this.bearerTokenSchema.safeParse(bearerToken);

    if (!parsedBearerToken.success) {
      // TODO: log the underlying error for debugging purposes
      console.warn(parsedBearerToken.error.message);
      return err(new AuthenticationError());
    }

    const { sessionId, sessionToken } = parsedBearerToken.data;

    return ok({ sessionId, sessionToken });
  }

  /**
   * Creates a Zod schema for a Bearer authorization header containing a session token.
   * The header must be in the format "Bearer <sessionId>.<sessionToken>".
   *
   * @param sessionTokenSchema The Zod schema to validate the session token part of the header.
   * @returns A Zod schema that validates the Bearer authorization header format and extracts the session ID and token.
   */
  private static createBearerTokenSchema<T extends TokenType>(
    sessionTokenSchema: AuthToken[T]["schema"],
  ) {
    return z
      .preprocess(
        (value, context) => {
          if (typeof value !== "string" || !value.startsWith(BearerPrefix)) {
            context.addIssue({
              code: "custom",
              message: "Invalid Bearer authorization header",
            });
            return z.NEVER;
          }

          const bearerValue = value.slice(BearerPrefix.length);
          const separatorIndex = bearerValue.indexOf(".");
          if (
            separatorIndex <= 0 ||
            separatorIndex === bearerValue.length - 1 ||
            separatorIndex !== bearerValue.lastIndexOf(".")
          ) {
            context.addIssue({
              code: "custom",
              message: "Invalid Bearer authorization header",
            });
            return z.NEVER;
          }

          const sessionId = bearerValue.slice(0, separatorIndex);
          const sessionToken = bearerValue.slice(separatorIndex + 1);
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

export class SessionBearerTokenParsingStrategy extends BearerTokenParsingBaseStrategy<"session"> {
  constructor() {
    super(PlainSessionTokenSchema);
  }
}

export class BpdBearerTokenParsingStrategy extends BearerTokenParsingBaseStrategy<"bpd"> {
  constructor() {
    super(PlainBpdSSOTokenSchema);
  }
}
