import {
  AuthenticationError,
  GenericError,
  NotFoundError,
  UseCase,
} from "@pagopa/hexagonal-core";
import { BaseSession } from "@pagopa/io-auth-n-identity-session";
import { err, ok, Result } from "neverthrow";

import { ProfilePort } from "../../domain/ports/outbound/profile.port.js";
import {
  FimsUser,
  FimsUserSchema,
} from "../../domain/value-objects/fims.vo.js";

export type GetUserForFimsInput = {
  session: BaseSession;
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

export const getUserForFims = async (
  session: BaseSession,
  profilePort: ProfilePort,
): Promise<Result<FimsUser, NotFoundError | GenericError>> => {
  const profileLookup = await profilePort.getProfile(session.fiscalCode);

  if (profileLookup.isErr()) {
    return err(profileLookup.error);
  }

  const profile = profileLookup.value;

  return ok(
    FimsUserSchema.parse({
      name: session.name,
      family_name: session.familyName,
      fiscal_code: session.fiscalCode,
      auth_time: session.createdAt.getTime(),
      acr: session.spidLevel,
      email: profile.isEmailValidated ? profile.email : undefined,
      date_of_birth: session.dateOfBirth.toISOString().slice(0, 10),
    }),
  );
};

export const makeGetUserForFimsUseCase =
  (deps: GetUserForFimsDeps): GetUserForFimsUseCase =>
  async ({ session }: GetUserForFimsInput) =>
    getUserForFims(session, deps.profilePort);
