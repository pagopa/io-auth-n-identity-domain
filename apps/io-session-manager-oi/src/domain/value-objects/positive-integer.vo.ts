import { z } from "zod";

export declare const _positiveIntegerBrand: unique symbol;

export const PositiveIntegerSchema = z.coerce
  .number()
  .int()
  .positive()
  .brand<typeof _positiveIntegerBrand>();

export type PositiveInteger = z.infer<typeof PositiveIntegerSchema>;
