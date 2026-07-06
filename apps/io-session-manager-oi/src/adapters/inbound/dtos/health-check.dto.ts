import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

import { HealthCheckOutputSchema as HealthCheckUseCaseOutput } from "../../../application/use-cases/health-check.use-case.js";

extendZodWithOpenApi(z);

export const HealthCheckOutputSchema = HealthCheckUseCaseOutput.meta({
  description: "Application health and version information.",
  id: "HealthCheckOutput",
});
