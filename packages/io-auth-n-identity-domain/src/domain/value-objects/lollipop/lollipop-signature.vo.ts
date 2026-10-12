import { z } from "zod";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export declare const BrandLollipopSignature: unique symbol;
/**
 * HTTP Signature value (RFC 9421), e.g. `sig1=:AAAA:`, as sent in the
 * `signature` header of a Lollipop-signed request.
 */
export const LollipopSignatureSchema = z
  .string()
  .regex(/^((sig[0-9]+)=:[A-Za-z0-9+/=]*:(, ?)?)+$/, {
    message: "Invalid Lollipop signature format",
  })
  .brand<typeof BrandLollipopSignature>();

export type LollipopSignature = z.infer<typeof LollipopSignatureSchema>;
