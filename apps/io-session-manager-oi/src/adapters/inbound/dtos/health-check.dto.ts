import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

import { HealthCheckOutputSchema } from "../../../application/use-cases/health-check.use-case.js";

extendZodWithOpenApi(z);

export const HealthCheckResponseDto = HealthCheckOutputSchema.extend({
  name: HealthCheckOutputSchema.shape.name.meta({
    description: "The application name.",
  }),
  version: HealthCheckOutputSchema.shape.version.meta({
    description: "The application version.",
    example: "0.0.1",
  }),
}).meta({
  description: "Application health and version information.",
  id: "HealthCheckOutput",
});
