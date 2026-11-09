import type { BaseError, UseCase } from "@pagopa/hexagonal-core";
import type { Logger } from "@pagopa/hexagonal-core/domain/ports";

/** Wraps a use case and logs errors without changing its returned result. */
export const withErrorResultLogging =
  (logger: Pick<Logger, "error">) =>
  <I extends object, O, E extends BaseError>(
    useCase: UseCase<I, O, E>,
  ): UseCase<I, O, E> =>
  async (input) => {
    const result = await useCase(input);

    if (result.isErr()) {
      logger.error("Request processing resulted in an error", {
        error: result.error.message,
      });
    }

    return result;
  };
