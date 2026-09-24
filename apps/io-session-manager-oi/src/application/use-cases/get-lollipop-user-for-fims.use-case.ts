import {
  AuthenticationError,
  NotFoundError,
  FiscalCode,
  GenericError,
  NonEmptyString,
  UseCase,
  ForbiddenError,
} from "@pagopa/hexagonal-core";
import { BaseSession } from "@pagopa/io-auth-n-identity-session";
import { LollipopActivationPort } from "@pagopa/io-auth-n-identity-session";
import { err, ok, Result } from "neverthrow";

import { LollipopPort } from "../../domain/ports/outbound/lollipop.port.js";
import { ProfilePort } from "../../domain/ports/outbound/profile.port.js";
import { FimsUser } from "../../domain/value-objects/fims.vo.js";

import { getUserForFims } from "./get-user-for-fims.use-case.js";

type LcParams =
  Awaited<ReturnType<LollipopPort["generateLCParams"]>> extends Result<
    infer T,
    unknown
  >
    ? T
    : never;

export type GetLollipopUserForFimsInput = {
  session: BaseSession;
  operationId: NonEmptyString;
};

export type GetLollipopUserForFimsOutput = {
  profile: FimsUser;
  lcParams: LcParams;
};

export type GetLollipopUserForFimsError =
  | AuthenticationError
  | ForbiddenError
  | NotFoundError
  | GenericError;

type GetLollipopUserForFimsDeps = {
  profilePort: ProfilePort;
  lollipopPort: LollipopPort;
  lollipopActivationPort: LollipopActivationPort;
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
) => {
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
  return ok(lcParamsGeneration.value);
};

export const makeGetLollipopUserForFimsUseCase =
  (deps: GetLollipopUserForFimsDeps): GetLollipopUserForFimsUseCase =>
  async ({ session, operationId }: GetLollipopUserForFimsInput) => {
    const [fimsUserResult, lcParamsResult] = await Promise.all([
      getUserForFims(session, deps.profilePort),
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
    const lcParams = lcParamsResult.value;

    return ok({
      profile: fimsUser,
      lcParams: lcParams,
    });
  };
