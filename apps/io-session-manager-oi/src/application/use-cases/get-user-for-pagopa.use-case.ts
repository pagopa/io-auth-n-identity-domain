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

export type GetUserForPagoPaInput = {
  session: BaseSession;
};

export type GetUserForPagoPaOutput = {
  name: NonEmptyString;
  family_name: NonEmptyString;
  fiscal_code: FiscalCode;
  spid_email?: EmailAddress;
  notice_email: EmailAddress;
};

export type GetUserForPagoPaError = AuthenticationError | GenericError;

type GetUserForPagoPaDeps = {
  profilePort: ProfilePort;
};

export type GetUserForPagoPaUseCase = UseCase<
  GetUserForPagoPaInput,
  GetUserForPagoPaOutput,
  GetUserForPagoPaError
>;

export const makeGetUserForPagoPaUseCase =
  (deps: GetUserForPagoPaDeps): GetUserForPagoPaUseCase =>
  async ({ session }: GetUserForPagoPaInput) => {
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
    const noticeEmail = profile.isEmailValidated ? profile.email : undefined;
    if (!noticeEmail) {
      return err(new GenericError("Notice email is not validated"));
    }

    return ok({
      name: session.name,
      family_name: session.familyName,
      fiscal_code: session.fiscalCode,
      spid_email: session.spidEmail,
      notice_email: noticeEmail,
    });
  };
