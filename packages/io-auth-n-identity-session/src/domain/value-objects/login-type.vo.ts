import { z } from "zod";

export const LoginTypeSchema = z.enum(["LV", "LEGACY"]);

export type LoginType = z.infer<typeof LoginTypeSchema>;
