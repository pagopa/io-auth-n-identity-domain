import { z } from "zod";

export const ConfigSchema = z.object({
  PORT: z.coerce.number().int().positive().max(65535).default(8000),
});

export type Config = z.infer<typeof ConfigSchema>;
