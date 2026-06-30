import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

extendZodWithOpenApi(z);

export const HealthcheckOutputSchema = z
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
    id: "HealthcheckOutput",
  });

  export const HealthcheckErrorSchema = z
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
    id: "InfoError",
  });
