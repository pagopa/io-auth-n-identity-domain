import {
  type FiscalCode,
  GenericError,
  type UseCase,
} from "@pagopa/hexagonal-core";
import type { TechnicalLockedProfilesPort } from "@pagopa/io-session-manager-core";
import { err, ok } from "neverthrow";

type TechnicalUnlockUserSessionInput = {
  fiscalCode: FiscalCode;
};

export type TechnicalUnlockUserSessionUseCase = UseCase<
  TechnicalUnlockUserSessionInput,
  void,
  GenericError
>;

export const makeTechnicalUnlockUserSessionUseCase =
  (
    technicalLockedProfilesPort: TechnicalLockedProfilesPort,
  ): TechnicalUnlockUserSessionUseCase =>
  async ({ fiscalCode }) => {
    const unlockResult = await technicalLockedProfilesPort.unlock(fiscalCode);
    return unlockResult.isErr()
      ? err(
          new GenericError(
            `Failed to unlock technical profile: ${unlockResult.error.message}`,
          ),
        )
      : ok(undefined);
  };
