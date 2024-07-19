import { monitorEventLoopDelay } from "perf_hooks";
import * as appInsights from "applicationinsights";

import { Express, RequestHandler } from "express";

const SERVER_UNDER_PRESSURE_VAR_NAME = "isServerUnderPressure";

export const startMeasuringEventLoop = (
  { EVENT_LOOP_DELAY_THREASHOLD }: { EVENT_LOOP_DELAY_THREASHOLD: number },
  app: Express,
  client?: appInsights.TelemetryClient,
) => {
  app.set(SERVER_UNDER_PRESSURE_VAR_NAME, false);

  const eventLoopDelayMonitor = monitorEventLoopDelay();
  eventLoopDelayMonitor.enable();

  // eslint-disable-next-line functional/no-let
  let startTime = process.hrtime();
  // eslint-disable-next-line functional/no-let
  let sampleSum = 0;
  // eslint-disable-next-line functional/no-let
  let sampleCount = 0;

  // Measure event loop scheduling delay
  setInterval(() => {
    const elapsed = process.hrtime(startTime);
    startTime = process.hrtime();
    sampleSum += elapsed[0] * 1e9 + elapsed[1];
    sampleCount++;
  }, 0);

  // Report custom metric every 5 seconds
  setInterval(() => {
    const samples = sampleSum;
    const count = sampleCount;
    sampleSum = 0;
    sampleCount = 0;

    const delay = eventLoopDelayMonitor.percentile(95) / 1e6; // Convert to milliseconds
    setImmediate(() =>
      client?.trackMetric({
        name: "New Event Loop Delay (ms)",
        value: delay,
      }),
    );

    eventLoopDelayMonitor.reset();

    if (count > 0) {
      const avgNs = samples / count;
      const avgMs = Math.round(avgNs / 1e6);

      app.set(
        SERVER_UNDER_PRESSURE_VAR_NAME,
        avgMs >= EVENT_LOOP_DELAY_THREASHOLD,
      );

      setImmediate(() =>
        client?.trackMetric({
          name: "Event Loop Delay (ms)",
          value: avgMs,
        }),
      );
    }
  }, 5000);
};

export const getServerUnavailableMiddleware: (app: Express) => RequestHandler =
  (app) => (req, res, next) => {
    const isServerUnderPressure = app.get(
      SERVER_UNDER_PRESSURE_VAR_NAME,
    ) as boolean;

    const isPathEnabledForMiddleware = req.url !== "/assertionConsumerService";

    if (isPathEnabledForMiddleware && isServerUnderPressure) {
      res.status(503).send();
    } else {
      next();
    }
  };
