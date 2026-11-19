import { NonEmptyStringSchema } from "@pagopa/hexagonal-core";
import { z } from "zod";

import { PositiveIntegerSchema } from "../positive-integer.vo.js";

export const JwtConfigSchema = z.object({
  JWT_TOKEN_ISSUER: NonEmptyStringSchema,
  // PEM-encoded private key; literal "\n" sequences are accepted
  JWT_TOKEN_PRIVATE_KEY: NonEmptyStringSchema,
  JWT_TOKEN_TTL_SECONDS: PositiveIntegerSchema,
});
