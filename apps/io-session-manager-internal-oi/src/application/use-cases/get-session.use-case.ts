import {
  type FiscalCode,
  GenericError,
  NotFoundError,
  type UseCase,
} from "@pagopa/hexagonal-core";
import type { SessionPort } from "@pagopa/io-auth-n-identity-session";
import { err, ok } from "neverthrow";

export type GetSessionInput = {
  fiscalCode: FiscalCode;
};

type GetSessionOutput = {
  active: boolean;
}

export type GetSessionUseCase = UseCase<
  GetSessionInput,
  GetSessionOutput,
  GenericError
>;

type Dependencies = Pick<SessionPort, "findActiveSession">;

export const makeGetSessionUseCase =
  (
    deps: Dependencies,
  ): UseCase<GetSessionInput, GetSessionOutput, GenericError> =>
  async ({ fiscalCode }) => {
    const activeSessionResult = await deps.findActiveSession(fiscalCode);

    if (activeSessionResult.isErr()) {
      if (activeSessionResult.error instanceof NotFoundError) {
        return ok({ active: false });
      }
      const error = new GenericError(
        `Failed to retrieve active session`,
      );

      error.cause = activeSessionResult.error;

      return err(error);
    }

    return ok({
      active: activeSessionResult.value.expirationDate.getTime() > Date.now(),
    });
  };
