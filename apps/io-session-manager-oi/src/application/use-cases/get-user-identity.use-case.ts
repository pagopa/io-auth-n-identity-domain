import { GenericError, NotFoundError, UseCase } from "@pagopa/hexagonal-core";
import type {
  BaseSession,
  LollipopActivation,
  LollipopActivationPort,
} from "@pagopa/io-auth-n-identity-session";
import { err, ok } from "neverthrow";

type GetUserIdentityUseCaseDeps = {
  lollipopActivationPort: LollipopActivationPort;
};

export type GetUserIdentityInput = {
  session: BaseSession;
};

export type GetUserIdentityOutput = Omit<BaseSession, "expirationDate"> & {
  tokenRemainingTtl: number;
  assertionRef?: LollipopActivation["assertionRef"];
};

export const makeGetUserIdentityUseCase =
  (
    deps: GetUserIdentityUseCaseDeps,
  ): UseCase<GetUserIdentityInput, GetUserIdentityOutput, GenericError> =>
  async ({ session }) => {
    const tokenRemainingTtl = Math.floor(
      (session.expirationDate.getTime() - Date.now()) / 1000,
    );
    if (tokenRemainingTtl <= 0) {
      return err(new GenericError("Unexpected session token TTL value"));
    }

    const maybeActivation = await deps.lollipopActivationPort.getByFiscalCode(
      session.fiscalCode,
    );
    // The assertion ref is optional: the user may not have a lollipop session
    if (
      maybeActivation.isErr() &&
      !(maybeActivation.error instanceof NotFoundError)
    ) {
      return err(
        new GenericError(
          "An error occurred while retrieving the lollipop activation",
        ),
      );
    }

    return ok({
      familyName: session.familyName,
      fiscalCode: session.fiscalCode,
      assertionRef: maybeActivation.isOk()
        ? maybeActivation.value.assertionRef
        : undefined,
      name: session.name,
      dateOfBirth: session.dateOfBirth,
      spidEmail: session.spidEmail,
      spidLevel: session.spidLevel,
      createdAt: session.createdAt,
      tokenRemainingTtl,
      sessionId: session.sessionId,
    });
  };
