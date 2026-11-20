import type { BaseError, UseCase } from "@pagopa/hexagonal-core";
import type { Logger } from "@pagopa/hexagonal-core/domain/ports";

/** Wraps a use case and logs errors without changing its returned result. */
export const withErrorResultLogging =
  (logger: Pick<Logger, "warn" | "trackException">) =>
  <I extends object, O, E extends BaseError>(
    useCase: UseCase<I, O, E>,
  ): UseCase<I, O, E> =>
  async (input) => {
    const result = await useCase(input);

    if (result.isErr()) {
      switch (result.error.kind) {
        case "GenericError": {
          logger.trackException({ error: result.error });
          break;
        }
        default:
          logger.warn(
            `${result.error.kind}. Error: ${JSON.stringify(result.error)}`,
          );
          break;
      }
    }

    return result;
  };
