import {
  AuthenticationError,
  FiscalCode,
  GenericError,
  NonEmptyString,
  UseCase,
} from "@pagopa/hexagonal-core";
import { BaseSession } from "@pagopa/io-auth-n-identity-session";
import { ok } from "neverthrow";

export type GetUserForBpdInput = {
  session: BaseSession;
};

export type GetUserForBpdOutput = {
  name: NonEmptyString;
  family_name: NonEmptyString;
  fiscal_code: FiscalCode;
};

export type GetUserForBpdError = AuthenticationError | GenericError;

export type GetUserForBpdUseCase = UseCase<
  GetUserForBpdInput,
  GetUserForBpdOutput,
  GetUserForBpdError
>;

export const getUserForBpdUseCase: GetUserForBpdUseCase = async ({
  session,
}) => {
  return ok({
    name: session.name,
    family_name: session.familyName,
    fiscal_code: session.fiscalCode,
  });
};
