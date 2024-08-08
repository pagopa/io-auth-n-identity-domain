import * as http from "http";
import * as https from "https";
import { Express } from "express";
import GracefulShutdown from "http-graceful-shutdown";
import { log } from "./logger";

/**
 * Initialize the graceful shutdown process adding utility logs and emit
 * the server:stop event on the final step.
 *
 */
export function initHttpGracefulShutdown(
  server: http.Server | https.Server,
  app: Express,
  options: GracefulShutdown.Options,
): void {
  log.info("Initializing server graceful shutdown");
  GracefulShutdown(server, {
    ...options,
    finally: () => {
      options.finally?.();
      // Showdown sincronization via emitted event
      log.info("On close: emit 'server:stop' event");
      const result = app.emit("server:stop");
      log.info(
        `On close: end emit 'server:stop' event. Listeners found: ${result}`,
      );
    },
  });
}
