import {
  AuthenticationError,
  EmailAddress,
  FiscalCode,
  GenericError,
  NonEmptyString,
  NotFoundError,
  UseCase,
} from "@pagopa/hexagonal-core";
import { BaseSession } from "@pagopa/io-auth-n-identity-session";
import { err, ok } from "neverthrow";

import { ProfilePort } from "../../domain/ports/outbound/profile.port.js";

export type GetUserForWalletInput = {
  session: BaseSession;
};

export type GetUserForWalletOutput = {
  name: NonEmptyString;
  family_name: NonEmptyString;
  fiscal_code: FiscalCode;
  spid_email?: EmailAddress;
  notice_email?: EmailAddress;
};

export type GetUserForWalletError = AuthenticationError | GenericError;

type GetUserForWalletDeps = {
  profilePort: ProfilePort;
};

export type GetUserForWalletUseCase = UseCase<
  GetUserForWalletInput,
  GetUserForWalletOutput,
  GetUserForWalletError
>;

export const makeGetUserForWalletUseCase =
  (deps: GetUserForWalletDeps): GetUserForWalletUseCase =>
  async ({ session }: GetUserForWalletInput) => {
    const profileLookup = await deps.profilePort.getProfile(session.fiscalCode);

    if (profileLookup.isErr()) {
      return err(
        profileLookup.error instanceof NotFoundError
          ? new GenericError(
              "Inconsistency: a profile for a valid token was not found",
            )
          : profileLookup.error,
      );
    }

    const profile = profileLookup.value;

    return ok({
      name: session.name,
      family_name: session.familyName,
      fiscal_code: session.fiscalCode,
      spid_email: session.spidEmail,
      // If the email is not validated yet, the value returned will be undefined
      notice_email: profile.isEmailValidated ? profile.email : undefined,
    });
  };
