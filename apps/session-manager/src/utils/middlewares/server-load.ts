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
  let iterations = 0;
  const intervalDelay = 500;
  const numberOfIterationsForMetrics = 5000 / intervalDelay;

  // Check event loop delay and update `isServerUnderPressure`
  setInterval(() => {
    // Convert mean and percentile to milliseconds
    const mean = eventLoopDelayMonitor.mean / 1e6;
    const percentile95 = eventLoopDelayMonitor.percentile(95) / 1e6;

    app.set(
      SERVER_UNDER_PRESSURE_VAR_NAME,
      mean >= EVENT_LOOP_DELAY_THREASHOLD,
    );

    // Report custom metric every 10 seconds
    if (++iterations >= numberOfIterationsForMetrics) {
      setImmediate(() =>
        client?.trackMetric({
          name: "Event Loop Delay - Mean (ms)",
          value: mean,
          min: eventLoopDelayMonitor.min,
          max: eventLoopDelayMonitor.max,
          stdDev: eventLoopDelayMonitor.stddev,
        }),
      );
      setImmediate(() =>
        client?.trackMetric({
          name: "Event Loop Delay - Percentile 95 (ms)",
          value: percentile95,
          min: eventLoopDelayMonitor.min,
          max: eventLoopDelayMonitor.max,
          stdDev: eventLoopDelayMonitor.stddev,
        }),
      );
      iterations = 0;
    }

    eventLoopDelayMonitor.reset();
  }, intervalDelay);
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
