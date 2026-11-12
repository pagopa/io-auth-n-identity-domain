import "dotenv/config";

import { FastifyOtelInstrumentation } from "@fastify/otel";
import { initAzureMonitor } from "@pagopa/azure-tracing/azure-monitor";
import { RuntimeNodeInstrumentation } from "@opentelemetry/instrumentation-runtime-node";

initAzureMonitor([
  new RuntimeNodeInstrumentation({
    monitoringPrecision: 5000,
  }),
  new FastifyOtelInstrumentation({ registerOnInitialization: true }),
]);
