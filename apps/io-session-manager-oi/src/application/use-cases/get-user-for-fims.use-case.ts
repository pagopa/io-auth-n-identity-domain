import {
  AuthenticationError,
  GenericError,
  NotFoundError,
  UseCase,
} from "@pagopa/hexagonal-core";
import type { FiscalCode, NonEmptyString, EmailAddress } from "@pagopa/hexagonal-core";
import { BaseSession } from "@pagopa/io-auth-n-identity-session";
import { err, ok } from "neverthrow";

import { ProfilePort } from "../../domain/ports/outbound/profile.port.js";

export type GetUserForFimsInput = {
  session: BaseSession;
};

export type FimsUser = {
  name: NonEmptyString;
  family_name: NonEmptyString;
  fiscal_code: FiscalCode;
  auth_time: number;
  acr: string;
  email: EmailAddress;
  date_of_birth: NonEmptyString;
};

export type GetUserForFimsOutput = FimsUser;

export type GetUserForFimsError =
  | AuthenticationError
  | NotFoundError
  | GenericError;

type GetUserForFimsDeps = {
  profilePort: ProfilePort;
};

export type GetUserForFimsUseCase = UseCase<
  GetUserForFimsInput,
  GetUserForFimsOutput,
  GetUserForFimsError
>;

export const makeGetUserForFimsUseCase =
  (deps: GetUserForFimsDeps): GetUserForFimsUseCase =>
  async ({ session }: GetUserForFimsInput) => {
    const profileLookup = await deps.profilePort.getProfile(session.fiscalCode);

    if (profileLookup.isErr()) {
      return err(profileLookup.error);
    }

    const profile = profileLookup.value;
    const email = profile.isEmailValidated ? profile.email : undefined;
    if (!email) {
      return err(new GenericError("Profile email is not validated"));
    }

    return ok({
      name: session.name,
      family_name: session.familyName,
      fiscal_code: session.fiscalCode,
      auth_time: session.createdAt.getTime(),
      acr: session.spidLevel,
      email: email,
      date_of_birth: session.dateOfBirth
        .toISOString()
        .slice(0, 10) as NonEmptyString,
    });
  };
