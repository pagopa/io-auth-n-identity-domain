import {
  AuthenticationError,
  FiscalCode,
  GenericError,
  NonEmptyString,
  NotFoundError,
  UseCase,
} from "@pagopa/hexagonal-core";
import { type SessionPort } from "@pagopa/io-auth-n-identity-session/ports";
import {
  type PlainBpdSSOToken,
  type SessionId,
  toHashedBpdSSOToken,
} from "@pagopa/io-auth-n-identity-session/value-objects";
import { err, ok } from "neverthrow";

export type GetUserForBpdInput = {
  sessionId: SessionId;
  sessionToken: PlainBpdSSOToken;
};

export type GetUserForBpdOutput = {
  name: NonEmptyString;
  family_name: NonEmptyString;
  fiscal_code: FiscalCode;
};

export type GetUserForBpdError = AuthenticationError | GenericError;

type GetUserForBpdDeps = {
  sessionPort: SessionPort;
};

export type GetUserForBpdUseCase = UseCase<
  GetUserForBpdInput,
  GetUserForBpdOutput,
  GetUserForBpdError
>;

export const makeGetUserForBpdUseCase =
  (deps: GetUserForBpdDeps): GetUserForBpdUseCase =>
  async (input) => {
    const lookup = await deps.sessionPort.findByBpdToken({
      sessionId: input.sessionId,
      hashedBPDSSOToken: toHashedBpdSSOToken(input.sessionToken),
    });

    if (lookup.isErr()) {
      // If the session is not found return AuthenticationError (legacy Session Manager's passport-bearer parity)
      if (lookup.error instanceof NotFoundError) {
        return err(new AuthenticationError());
      }
      return err(lookup.error);
    }

    const session = lookup.value;
    return ok({
      name: session.name,
      family_name: session.familyName,
      fiscal_code: session.fiscalCode,
    });
  };
