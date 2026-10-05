import {
  AuthenticationError,
  GenericError,
  NotFoundError,
  UseCase,
  ValidationError,
  UnprocessableEntityError,
} from "@pagopa/hexagonal-core";
import type {
  FiscalCode,
  NonEmptyString,
  EmailAddress,
} from "@pagopa/hexagonal-core";
import { BaseSession } from "@pagopa/io-auth-n-identity-session";
import type { SpidLevel } from "@pagopa/io-auth-n-identity-session/value-objects";
import { err, ok } from "neverthrow";

import { ProfilePort } from "../../domain/ports/outbound/profile.port.js";

export type GetUserForFimsInput = {
  session: BaseSession;
};

export type FimsUser = {
  name: NonEmptyString;
  familyName: NonEmptyString;
  fiscalCode: FiscalCode;
  authTime: number;
  acr: SpidLevel;
  email: EmailAddress;
  dateOfBirth: NonEmptyString;
};

export type GetUserForFimsOutput = FimsUser;

export type GetUserForFimsError =
  | AuthenticationError
  | NotFoundError
  | GenericError
  | ValidationError
  | UnprocessableEntityError;

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
      // TODO: use `UnprocessableEntityError` instead of `ValidationError` after downstream services support it
      return err(new ValidationError("Profile email is not validated"));
    }

    return ok({
      name: session.name,
      familyName: session.familyName,
      fiscalCode: session.fiscalCode,
      authTime: session.createdAt.getTime(),
      acr: session.spidLevel,
      email: email,
      dateOfBirth: session.dateOfBirth
        .toISOString()
        .slice(0, 10) as NonEmptyString,
    });
  };
