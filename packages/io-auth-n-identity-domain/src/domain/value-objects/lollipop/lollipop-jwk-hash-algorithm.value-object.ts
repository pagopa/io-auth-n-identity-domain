import { z } from "zod";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export declare const BrandLollipopJwkHashAlgo: unique symbol;
/**
 * Hashing algorithm used to compute the JWK thumbprint of the lollipop public key.
 */
export const LollipopJwkHashingAlgorithmSchema = z
  .enum(["sha256", "sha384", "sha512"])
  .default("sha256")
  .brand<typeof BrandLollipopJwkHashAlgo>();

export type LollipopJwkHashingAlgorithm = z.infer<
  typeof LollipopJwkHashingAlgorithmSchema
>;
