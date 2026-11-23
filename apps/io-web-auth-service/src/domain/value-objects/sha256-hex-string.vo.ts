import { z } from "zod";

export declare const Sha256HexStringBrand: unique symbol;

// TODO(IOPLT-2285): replace with Platform's common Sha256HexString schema
export const Sha256HexStringSchema = z
  .hash("sha256", { enc: "hex" })
  .toLowerCase()
  .brand<typeof Sha256HexStringBrand>();

export type Sha256HexString = z.infer<typeof Sha256HexStringSchema>;
