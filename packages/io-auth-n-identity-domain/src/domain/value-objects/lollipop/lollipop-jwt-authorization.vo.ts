import { NonEmptyStringSchema } from "@pagopa/hexagonal-core";
import { z } from "zod";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export declare const BrandLollipopJwtAuthorization: unique symbol;
/**
 * Authentication JWT bearer value sent in the `x-pagopa-lollipop-auth-jwt`
 * header of a Lollipop-signed request.
 */
export const LollipopJwtAuthorizationSchema =
  NonEmptyStringSchema.brand<typeof BrandLollipopJwtAuthorization>();

export type LollipopJwtAuthorization = z.infer<
  typeof LollipopJwtAuthorizationSchema
>;
