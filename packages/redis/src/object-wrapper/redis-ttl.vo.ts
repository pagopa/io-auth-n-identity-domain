import { z } from "zod";

export declare const _redisTtlSecondsBrand: unique symbol;

export const RedisTtlSecondsSchema = z
  .number()
  .int()
  .positive()
  .brand<typeof _redisTtlSecondsBrand>();

export type RedisTtlSeconds = z.infer<typeof RedisTtlSecondsSchema>;
