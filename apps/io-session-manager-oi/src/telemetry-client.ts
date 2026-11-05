import { SeverityNumber, Logger, logs } from "@opentelemetry/api-logs";
import { emitCustomEvent } from "@pagopa/azure-tracing/logger";
import { NonEmptyString } from "@pagopa/hexagonal-core";
import type { AppInsightsTelemetryClient } from "@pagopa/hexagonal-core/adapters/logger";
import { makeApplicationInsightsLogger } from "@pagopa/hexagonal-core/adapters/logger";

const stringify = (p?: Record<string, unknown>): Record<string, string> =>
  Object.fromEntries(Object.entries(p ?? {}).map(([k, v]) => [k, String(v)]));

const makeTelemetryClient = (aiLogger: Logger): AppInsightsTelemetryClient => ({
  trackEvent: ({ name, properties }) =>
    emitCustomEvent(name, stringify(properties))(),
  trackException: ({ exception, properties }) =>
    aiLogger.emit({
      attributes: {
        ...stringify(properties),
        "exception.stack": exception.stack ?? "",
      },
      body: exception.message,
      severityNumber: SeverityNumber.ERROR,
    }),
  trackTrace: ({ message, properties, severity }) =>
    aiLogger.emit({
      attributes: stringify(properties),
      body: message,
      severityNumber: severity as SeverityNumber,
    }),
});

export const getLogger = (
  service: NonEmptyString,
  version: string | undefined = undefined,
) => {
  const name = version ? `${service}@${version}` : service;
  const logger = logs.getLogger(name);
  const client = makeTelemetryClient(logger);

  return makeApplicationInsightsLogger({
    client: client,
    baseProperties: { service },
  });
};
