import { NonEmptyStringBrand } from "@pagopa/hexagonal-core";
import { LollipopAssertionRefSchema } from "@pagopa/io-auth-n-identity-domain";
import {
  ExtendedPlainZendeskSSOTokenSchema,
  PlainBpdSSOTokenSchema,
  PlainFimsSSOTokenSchema,
  PlainPagoPaSSOTokenSchema,
  SessionIdSchema,
  SpidLevelSchema,
} from "@pagopa/io-auth-n-identity-session";
import { z } from "zod";

// This is a temporary workaround to ensure that the branded types are included in the type system.
const _brands = [NonEmptyStringBrand];

const withSessionId = (tokenSchema: z.core.$ZodTemplateLiteralPart) =>
  z.templateLiteral([SessionIdSchema, ".", tokenSchema]).meta({
    type: "string",
  });

export const GetSessionOutputDTO = z
  .object({
    spidLevel: SpidLevelSchema.optional(),
    expirationDate: z.date().optional(),
    lollipopAssertionRef: LollipopAssertionRefSchema.optional(),
    walletToken: withSessionId(PlainPagoPaSSOTokenSchema).optional(),
    pagopaToken: withSessionId(PlainPagoPaSSOTokenSchema).optional(),
    bpdToken: withSessionId(PlainBpdSSOTokenSchema).optional(),
    zendeskToken: withSessionId(ExtendedPlainZendeskSSOTokenSchema).optional(),
    fimsToken: withSessionId(PlainFimsSSOTokenSchema).optional(),
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
      .split(",")
      .map((field) => field.trim()),
  )
  .pipe(SessionFieldSchema.array().min(1))
  .default(SessionFieldSchema.options)
  .transform((fields) => new Set(fields)); // Converts the array of field names into a Set for easier lookup and uniqueness
export type FieldsQueryParam = z.infer<typeof FieldsQueryParamSchema>;

/**
 * Request schema for the GET /session endpoint.
 * The `fields` query parameter allows the client to obtain only the requested parameters.
 * NOTE: nested fields retrieval is currently not supported.
 * NOTE: field names are case-sensitive
 * Example: ?fields=(spidLevel,walletToken)
 * For more info, see https://opensource.zalando.com/restful-api-guidelines/#157
 */
export const GetSessionInputDTO = {
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
