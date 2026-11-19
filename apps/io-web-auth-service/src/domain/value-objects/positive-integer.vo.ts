import { z } from "zod";

export declare const _positiveIntegerBrand: unique symbol;

// TODO(IOPLT-2285): replace with Platform's common PositiveInteger schema
export const PositiveIntegerSchema = z.coerce
  .number()
  .int()
  .positive()
  .brand<typeof _positiveIntegerBrand>();

export type PositiveInteger = z.infer<typeof PositiveIntegerSchema>;
