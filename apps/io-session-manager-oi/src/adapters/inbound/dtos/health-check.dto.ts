import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

extendZodWithOpenApi(z);

export const HealthCheckOutputSchema = z
  .object({
    name: z.string().meta({
      description: "The application name.",
    }),
    version: z
      .string()
      .meta({ description: "The application version.", example: "0.0.1" }),
  })
  .meta({
    description: "Application health and version information.",
    id: "HealthCheckOutput",
  });
