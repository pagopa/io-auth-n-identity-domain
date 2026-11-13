import {
  SeverityNumber,
  logs,
  type Logger as OpenTelemetryLogger,
} from "@opentelemetry/api-logs";
import { emitCustomEvent } from "@pagopa/azure-tracing/logger";
import { NonEmptyString } from "@pagopa/hexagonal-core";
import {
  type AppInsightsTelemetryClient,
  makeApplicationInsightsLogger,
} from "@pagopa/hexagonal-core/adapters/logger";
import type { Logger } from "@pagopa/hexagonal-core/domain/ports";

const severities = {
  0: SeverityNumber.DEBUG,
  1: SeverityNumber.INFO,
  2: SeverityNumber.WARN,
  3: SeverityNumber.ERROR,
  4: SeverityNumber.FATAL,
} as const;

const stringify = (p?: Record<string, unknown>): Record<string, string> =>
  Object.fromEntries(Object.entries(p ?? {}).map(([k, v]) => [k, String(v)]));

const makeTelemetryClient = (
  aiLogger: OpenTelemetryLogger,
): AppInsightsTelemetryClient => ({
  trackEvent: ({ name, properties }) =>
    emitCustomEvent(name, stringify(properties))(),
  trackException: ({ exception, properties }) =>
    aiLogger.emit({
      attributes: {
        ...stringify(properties),
        "exception.type": exception.name,
        "exception.stacktrace": exception.stack ?? "",
        "exception.message": exception.message,
      },
      body: exception.message,
      severityNumber: SeverityNumber.ERROR,
    }),
  trackTrace: ({ message, properties, severity }) =>
    aiLogger.emit({
      attributes: stringify(properties),
      body: message,
      severityNumber: severities[severity],
    }),
});

/**
 * Creates a service logger whose component-scoped variants share one telemetry client.
 *
 * @param service - Service name used as the OpenTelemetry logger name.
 * @param version - Service version attached to every record.
 * @returns The service logger.
 */
export const getLogger = (
  service: NonEmptyString,
  version: NonEmptyString,
): Logger =>
  makeApplicationInsightsLogger({
    client: makeTelemetryClient(logs.getLogger(service)),
    baseProperties: { service, version },
  });
