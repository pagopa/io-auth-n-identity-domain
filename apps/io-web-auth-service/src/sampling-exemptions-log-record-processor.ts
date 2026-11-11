import { TraceFlags } from "@opentelemetry/api";
import {
  BatchLogRecordProcessor,
  type SdkLogRecord,
} from "@opentelemetry/sdk-logs";

export class SamplingExemptionsLogRecordProcessor extends BatchLogRecordProcessor {
  override onEmit(record: SdkLogRecord): void {
    if (
      !record.spanContext?.spanId ||
      Number(record.spanContext.traceFlags) === Number(TraceFlags.SAMPLED)
    ) {
      return;
    }

    const attributes = record.attributes;
    const isException = Boolean(
      attributes["exception.type"] && attributes["exception.stacktrace"],
    );
    const isExemptEvent =
      Boolean(attributes["microsoft.custom_event.name"]) &&
      (attributes.samplingEnabled === false ||
        attributes.samplingEnabled === "false");

    if (isException || isExemptEvent) {
      super.onEmit(record);
    }
  }
}
