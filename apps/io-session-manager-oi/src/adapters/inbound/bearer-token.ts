import { SessionIdSchema } from "@pagopa/io-auth-n-identity-session";
import { z } from "zod";

const BearerPrefix = "Bearer ";

/**
 * Creates a Zod schema for a Bearer authorization header containing a session token.
 * The header must be in the format "Bearer <sessionId>.<sessionToken>".
 *
 * @param sessionTokenSchema The Zod schema to validate the session token part of the header.
 * @returns A Zod schema that validates the Bearer authorization header format and extracts the session ID and token.
 */
export const createBearerTokenSchema = <
  SessionTokenSchema extends z.ZodType<unknown, string>,
>(
  sessionTokenSchema: SessionTokenSchema,
) =>
  z.preprocess(
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
  );
