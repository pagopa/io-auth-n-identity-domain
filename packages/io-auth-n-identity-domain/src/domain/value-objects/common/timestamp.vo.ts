import { z } from "zod";

export const TimestampSchema = z.date();
export type TimestampSchema = z.infer<typeof TimestampSchema>;
