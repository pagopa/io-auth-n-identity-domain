import {
  AuthenticationError,
  NotFoundError,
  FiscalCode,
  GenericError,
  NonEmptyString,
  UseCase,
  ForbiddenError,
  ValidationError,
  UnprocessableEntityError,
} from "@pagopa/hexagonal-core";
import {
  LollipopJwk,
  LollipopAssertionRef,
} from "@pagopa/io-auth-n-identity-domain";
import { BaseSession } from "@pagopa/io-auth-n-identity-session";
import { LollipopActivationPort } from "@pagopa/io-auth-n-identity-session";
import { err, ok, Result } from "neverthrow";

import { LollipopPort } from "../../domain/ports/outbound/lollipop.port.js";
import { ProfilePort } from "../../domain/ports/outbound/profile.port.js";

import {
  GetUserForFimsUseCase,
  type FimsUser,
} from "./get-user-for-fims.use-case.js";

export type GetLollipopUserForFimsInput = {
  session: BaseSession;
  operationId: NonEmptyString;
};

type LcParamsForFims = {
  assertion_ref: LollipopAssertionRef;
  pub_key: LollipopJwk;
  lc_authentication_bearer: NonEmptyString;
};

export type GetLollipopUserForFimsOutput = {
  profile: FimsUser;
  lc_params: LcParamsForFims;
};

export type GetLollipopUserForFimsError =
  | AuthenticationError
  | ForbiddenError
  | NotFoundError
  | GenericError
  | ValidationError
  | UnprocessableEntityError;

type GetLollipopUserForFimsDeps = {
  profilePort: ProfilePort;
  lollipopPort: LollipopPort;
  lollipopActivationPort: LollipopActivationPort;
  getUserForFimsUseCase: GetUserForFimsUseCase;
};

export type GetLollipopUserForFimsUseCase = UseCase<
  GetLollipopUserForFimsInput,
  GetLollipopUserForFimsOutput,
  GetLollipopUserForFimsError
>;

const generateLcParamsForFimsUser = async (
  fiscalCode: FiscalCode,
  operationId: NonEmptyString,
  lollipopPort: LollipopPort,
  lollipopActivationPort: LollipopActivationPort,
): Promise<
  Result<LcParamsForFims, ForbiddenError | NotFoundError | GenericError>
> => {
  const lollipopActivationLookup =
    await lollipopActivationPort.getByFiscalCode(fiscalCode);
  if (lollipopActivationLookup.isErr()) {
    return err(lollipopActivationLookup.error);
  }
  const lollipopActivation = lollipopActivationLookup.value;

  const lcParamsGeneration = await lollipopPort.generateLCParams(
    lollipopActivation.assertionRef,
    {
      operation_id: operationId,
    },
  );
  if (lcParamsGeneration.isErr()) {
    return err(lcParamsGeneration.error);
  }

  const lcParams = lcParamsGeneration.value;

  return ok({
    assertion_ref: lcParams.assertion_ref,
    pub_key: lcParams.pub_key,
    lc_authentication_bearer: lcParams.lc_authentication_bearer,
  });
};

export const makeGetLollipopUserForFimsUseCase =
  (deps: GetLollipopUserForFimsDeps): GetLollipopUserForFimsUseCase =>
  async ({ session, operationId }: GetLollipopUserForFimsInput) => {
    const [fimsUserResult, lcParamsResult] = await Promise.all([
      deps.getUserForFimsUseCase({ session }),
      generateLcParamsForFimsUser(
        session.fiscalCode,
        operationId,
        deps.lollipopPort,
        deps.lollipopActivationPort,
      ),
    ]);

    if (fimsUserResult.isErr()) {
      return err(fimsUserResult.error);
    }
    const fimsUser = fimsUserResult.value;

    if (lcParamsResult.isErr()) {
      return err(lcParamsResult.error);
    }
    const lcParams: LcParamsForFims = lcParamsResult.value;

    return ok({
      profile: fimsUser,
      lc_params: lcParams,
    });
  };
