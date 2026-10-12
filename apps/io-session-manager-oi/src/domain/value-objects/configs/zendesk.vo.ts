import { NonEmptyStringSchema } from "@pagopa/hexagonal-core";
import { z } from "zod";

import { CidrV4ReadonlyArray } from "../cidr-v4-readonly-array.vo.js";
import { PositiveIntegerSchema } from "../positive-integer.vo.js";

export const ZendeskConfigSchema = z.object({
  ALLOW_ZENDESK_IP_SOURCE_RANGE: CidrV4ReadonlyArray,
  JWT_ZENDESK_SUPPORT_TOKEN_SECRET: NonEmptyStringSchema,
  JWT_ZENDESK_SUPPORT_TOKEN_EXPIRATION: PositiveIntegerSchema.default(
    PositiveIntegerSchema.parse(604800),
  ),
  JWT_ZENDESK_SUPPORT_TOKEN_ISSUER: NonEmptyStringSchema,
});

export type ZendeskConfig = z.infer<typeof ZendeskConfigSchema>;
