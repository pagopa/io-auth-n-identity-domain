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
import { type SpidLevel } from "@pagopa/io-auth-n-identity-session/value-objects";
import { err, ok } from "neverthrow";
import { z } from "zod";

import { ProfilePort } from "../../domain/ports/outbound/profile.port.js";

const _IsoDateSchema = z.iso.date();
type IsoDate = z.infer<typeof _IsoDateSchema>;

export type GetUserForFimsInput = {
  session: BaseSession;
};

export type GetUserForFimsOutput = {
  name: NonEmptyString;
  family_name: NonEmptyString;
  fiscal_code: FiscalCode;
  auth_time: number;
  acr: SpidLevel;
  email?: EmailAddress;
  date_of_birth: IsoDate;
};

export type GetUserForFimsError = AuthenticationError | GenericError;

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
      auth_time: session.createdAt.getTime(),
      acr: session.spidLevel,
      // If the email is not validated yet, the value returned will be undefined
      email: profile.isEmailValidated ? profile.email : undefined,
      // Convert the date of birth to a string in the format YYYY-MM-DD.
      // The index 0 to 10 extracts the YYYY-MM-DD part of the ISO string, splitting at the "T" character.
      date_of_birth: session.dateOfBirth.toISOString().slice(0, 10),
    });
  };
