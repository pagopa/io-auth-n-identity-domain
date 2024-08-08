/* eslint-disable turbo/no-undeclared-env-vars */
export const PORT = process.env.WEBSITES_PORT ?? 3000;

// Set default for graceful-shutdown
const DEFAULT_SHUTDOWN_SIGNALS = "SIGINT SIGTERM";
const DEFAULT_SHUTDOWN_TIMEOUT_MILLIS = 30000;

export const SHUTDOWN_SIGNALS: string =
  process.env.SHUTDOWN_SIGNALS || DEFAULT_SHUTDOWN_SIGNALS;

export const SHUTDOWN_TIMEOUT_MILLIS: number = process.env
  .DEFAULT_SHUTDOWN_TIMEOUT_MILLIS
  ? parseInt(process.env.DEFAULT_SHUTDOWN_TIMEOUT_MILLIS, 10)
  : DEFAULT_SHUTDOWN_TIMEOUT_MILLIS;
