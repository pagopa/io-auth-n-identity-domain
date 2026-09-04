import { LollipopAssertionRefSchema } from "@pagopa/io-auth-n-identity-domain";
import {
  ExtendedPlainZendeskSSOTokenSchema,
  PlainBpdSSOTokenSchema,
  PlainFimsSSOTokenSchema,
  PlainSessionTokenSchema,
  PlainWalletSSOTokenSchema,
  SessionIdSchema,
  SpidLevelSchema,
} from "@pagopa/io-auth-n-identity-session";
import { z } from "zod";

export const GetSessionOutputDTO = z
  .object({
    spidLevel: SpidLevelSchema.optional(),
    expirationDate: z.date().optional(),
    lollipopAssertionRef: LollipopAssertionRefSchema.optional(),
    walletToken: PlainWalletSSOTokenSchema.optional(),
    bpdToken: PlainBpdSSOTokenSchema.optional(),
    zendeskToken: ExtendedPlainZendeskSSOTokenSchema.optional(),
    fimsToken: PlainFimsSSOTokenSchema.optional(),
  })
  .meta({
    id: "PublicSession",
    description: "The public session data that can be retrieved by the client",
  });
export type GetSessionOutputDTO = z.infer<typeof GetSessionOutputDTO>;

const SessionFieldSchema = GetSessionOutputDTO.keyof();

const FieldsQueryParamSchema = z
  .stringFormat("fields-filter", /^\([^()]+\)$/) // Matches a string that starts with '(' and ends with ')' and does not contain any parentheses inside
  .transform((fields) =>
    fields
      .slice(1, -1) // Remove the surrounding parentheses
      .trim()
      .split(",")
      .map((field) => field.trim()),
  )
  .pipe(z.array(SessionFieldSchema).min(1))
  .default(SessionFieldSchema.options);
export type FieldsQueryParam = z.infer<typeof FieldsQueryParamSchema>;

const BearerSessionTokenSchema = z
  .string()
  .regex(/^Bearer [^.]+\.[^.]+$/) // Matches a string that starts with "Bearer " followed by two non-empty strings separated by a dot
  .transform((authorization) => {
    const [sessionId, sessionToken] = authorization
      .slice("Bearer ".length)
      .split(".");
    return { sessionId, sessionToken };
  })
  .pipe(
    z.object({
      sessionId: SessionIdSchema,
      sessionToken: PlainSessionTokenSchema,
    }),
  );

/**
 * Request schema for the GET /session endpoint.
 * The `fields` query parameter allows the client to obtain only the requested parameters.
 * NOTE: nested fields retrieval is currently not supported.
 * NOTE: field names are case-sensitive
 * Example: ?fields=(spidLevel,walletToken)
 * For more info, see https://opensource.zalando.com/restful-api-guidelines/#157
 */
export const GetSessionInputDTO = {
  headers: z.object({
    authorization: BearerSessionTokenSchema,
  }),
  query: z.object({
    fields: FieldsQueryParamSchema.meta({
      id: "FieldsFilter",
      description:
        "The use of this parameters allows the client to obtain only the requested parameters. NOTE: nested fields retrieval is currently not supported. NOTE: field names are case-sensitive Example: ?fields=(spidLevel,walletToken) For more info, see https://opensource.zalando.com/restful-api-guidelines/#157",
      example: "(spidLevel,walletToken)",
    }),
  }),
};
export type GetSessionInputDTO = z.infer<typeof GetSessionInputDTO>;
