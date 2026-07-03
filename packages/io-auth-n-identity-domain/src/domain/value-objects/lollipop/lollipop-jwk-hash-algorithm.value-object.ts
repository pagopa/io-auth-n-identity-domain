import { z } from "zod";

/**
 * Hashing algorithm used to compute the JWK thumbprint of the lollipop public key.
 */
export const LollipopJwkHashingAlgorithmSchema = z
  .enum(["sha256", "sha384", "sha512"])
  .default("sha256")
  .describe("Hashing algorithm for the lollipop public key thumbprint")
  .brand<"LollipopJwkHashAlgo">();

export type LollipopJwkHashingAlgorithm = z.infer<
  typeof LollipopJwkHashingAlgorithmSchema
>;
