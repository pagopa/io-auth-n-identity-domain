import {
  type LogRecord,
  type LoggerProvider,
  SeverityNumber,
  logs,
} from "@opentelemetry/api-logs";
import { emitCustomEvent } from "@pagopa/azure-tracing/logger";
import type { NonEmptyString } from "@pagopa/hexagonal-core";
import {
  type AppInsightsTelemetryClient,
  makeApplicationInsightsLogger,
} from "@pagopa/hexagonal-core/adapters/logger";
import type { Logger } from "@pagopa/hexagonal-core/domain/ports";

const stringify = (
  properties?: Record<string, unknown>,
): Record<string, string> =>
  Object.fromEntries(
    Object.entries(properties ?? {}).map(([key, value]) => [
      key,
      String(value),
    ]),
  );

const severities = {
  0: SeverityNumber.DEBUG,
  1: SeverityNumber.INFO,
  2: SeverityNumber.WARN,
  3: SeverityNumber.ERROR,
  4: SeverityNumber.FATAL,
} as const;

export const getLogger = (service: NonEmptyString): Logger => {
  const logger = logs.getLogger(service);
  const telemetryEnabled = Boolean(
    process.env.APPLICATIONINSIGHTS_CONNECTION_STRING?.trim(),
  );
  const emit = (record: LogRecord): void => {
    if (telemetryEnabled) {
      logger.emit(record);
    } else if ((record.severityNumber ?? 0) >= SeverityNumber.ERROR) {
      console.error(record.body, record.attributes);
    } else if (record.severityNumber === SeverityNumber.WARN) {
      console.warn(record.body, record.attributes);
    } else {
      console.info(record.body, record.attributes);
    }
  };

  const client: AppInsightsTelemetryClient = {
    flush: async () => {
      const provider: LoggerProvider & { forceFlush?: () => Promise<void> } =
        logs.getLoggerProvider();
      await provider.forceFlush?.();
    },
    trackEvent: ({ name, properties }) => {
      if (telemetryEnabled) {
        emitCustomEvent(name, stringify(properties))();
      } else {
        emit({ body: name, attributes: stringify(properties) });
      }
    },
    trackException: ({ exception, properties }) =>
      emit({
        attributes: {
          ...stringify(properties),
          "exception.message": exception.message,
          "exception.type": exception.name,
          "exception.stacktrace": exception.stack ?? "",
        },
        body: exception.message,
        severityNumber: SeverityNumber.ERROR,
      }),
    trackTrace: ({ message, properties, severity }) =>
      emit({
        attributes: stringify(properties),
        body: message,
        severityNumber: severities[severity],
      }),
  };

  return makeApplicationInsightsLogger({ client, baseProperties: {} });
};
