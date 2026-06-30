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
    errors: z
      .array(z.string())
      .readonly()
      .optional()
      .meta({ description: "Health check errors, present when unhealthy." }),
  })
  .meta({
    description: "Application health and version information.",
    id: "HealthCheckOutput",
  });

export const HealthCheckErrorSchema = z
  .object({
    name: z.string().meta({
      description: "The application name.",
    }),
    version: z
      .string()
      .meta({ description: "The application version.", example: "0.0.1" }),
    errors: z.array(z.string()).meta({
      description: "List of errors encountered.",
    }),
  })
  .meta({
    description: "Application errors and version information.",
    id: "HealthCheckError",
  });
