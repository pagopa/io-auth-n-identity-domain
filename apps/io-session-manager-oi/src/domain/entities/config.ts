import { z } from "zod";

export const ConfigSchema = z.object({
  HOST: z.union([z.ipv4(), z.ipv6(), z.literal("localhost")]),
  PORT: z.coerce.number().int().positive().max(65535),
});

export type Config = z.infer<typeof ConfigSchema>;
