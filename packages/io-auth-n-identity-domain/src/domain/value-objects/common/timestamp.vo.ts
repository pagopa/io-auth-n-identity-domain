import { z } from "zod";

export const TimestampSchema = z.coerce.date();
export type TimestampSchema = z.infer<typeof TimestampSchema>;
