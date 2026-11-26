import {
  type FiscalCode,
  type GenericError,
  type NonEmptyString,
  type UseCase,
} from "@pagopa/hexagonal-core";
import { err, ok } from "neverthrow";

import { type ActiveSession } from "../../domain/entitites/active-session.entity.js";
import { type SessionPort } from "../../domain/ports/outbound/session.port.js";
import { type SpidLevel } from "../../domain/value-objects/login.vo.js";

export type ActivateUserSessionInput = {
  fiscalCode: FiscalCode;
  name: NonEmptyString;
  familyName: NonEmptyString;
  spidLevel: SpidLevel;
};

export type ActivateUserSessionUseCase = UseCase<
  ActivateUserSessionInput,
  NonEmptyString,
  GenericError
>;

type Dependencies = {
  sessionPort: SessionPort;
};

/**
 * Activates a web session for an already authenticated user, returning the
 * session token to hand over to the client.
 */
export const makeActivateUserSessionUseCase =
  (deps: Dependencies): ActivateUserSessionUseCase =>
  async (input) => {
    const activeSession: ActiveSession = {
      name: input.name,
      family_name: input.familyName,
      fiscal_number: input.fiscalCode,
      spid_level: input.spidLevel,
    };

    const sessionTokenResult = await deps.sessionPort.create(activeSession);
    if (sessionTokenResult.isErr()) {
      return err(sessionTokenResult.error);
    }

    return ok(sessionTokenResult.value);
  };
