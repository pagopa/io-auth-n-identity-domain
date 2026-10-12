import { z } from "zod";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export declare const BrandLollipopSignatureInput: unique symbol;
/**
 * HTTP Signature-Input value (RFC 9421), e.g.
 * `sig1=("@method");created=1618884475`, as sent in the `signature-input`
 * header of a Lollipop-signed request.
 */
export const LollipopSignatureInputSchema = z
  .string()
  .regex(/^(?:sig\d+=[^,]*)(?:,\s*(?:sig\d+=[^,]*))*$/, {
    message: "Invalid Lollipop signature-input format",
  })
  .brand<typeof BrandLollipopSignatureInput>();

export type LollipopSignatureInput = z.infer<
  typeof LollipopSignatureInputSchema
>;
