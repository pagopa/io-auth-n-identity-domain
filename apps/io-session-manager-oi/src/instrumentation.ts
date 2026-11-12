import { FastifyOtelInstrumentation } from "@fastify/otel";
import { initAzureMonitor } from "@pagopa/azure-tracing/azure-monitor";

initAzureMonitor([
  new FastifyOtelInstrumentation({ registerOnInitialization: true }),
]);
