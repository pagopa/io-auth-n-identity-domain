import { BaseError } from "@pagopa/io-core-domain/errors";

/**
 * Generic error for configuration loading failures.
 */
export class ConfigError extends BaseError {
  override readonly kind = "ConfigError" as const;
  override readonly tag = "config-error";

  constructor(message: string) {
    super(`Configuration error: ${message}`);
  }
}
