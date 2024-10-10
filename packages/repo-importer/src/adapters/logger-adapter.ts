import winston from "winston";
import { LoggerPort } from "../ports/logger";

export const loggerAdapter: LoggerPort = {
  info: (message: string) => {
    winston
      .createLogger({
        level: "info",
        format: winston.format.simple(),
        transports: [new winston.transports.Console()],
      })
      .info(message);
  },

  error: (message: string, error?: unknown) => {
    winston
      .createLogger({
        level: "error",
        format: winston.format.simple(),
        transports: [new winston.transports.Console()],
      })
      .error(`${message}: ${error}`);
  },
};
