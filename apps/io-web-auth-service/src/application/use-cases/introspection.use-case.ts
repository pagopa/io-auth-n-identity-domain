import {
  AuthenticationError,
  ForbiddenError,
  GenericError,
  NonEmptyString,
  UseCase,
} from "@pagopa/hexagonal-core";
import { err, ok } from "neverthrow";

import { ActiveSession } from "../../domain/entitites/active-session.entity.js";
import { SessionBlacklistPort } from "../../domain/ports/outbound/session-blacklist.port.js";
import { SessionPort } from "../../domain/ports/outbound/session.port.js";

export type IntrospectionInput = {
  token: NonEmptyString;
};

export type IntrospectionDeps = {
  sessionBlacklistPort: SessionBlacklistPort;
  sessionPort: SessionPort;
};

export type IntrospectionOutput = {
  readonly active: true;
  readonly user: ActiveSession;
};

export const makeIntrospectionUseCase =
  (
    deps: IntrospectionDeps,
  ): UseCase<
    IntrospectionInput,
    IntrospectionOutput,
    AuthenticationError | ForbiddenError | GenericError
  > =>
  async ({ token }) => {
    const checkResult = await deps.sessionPort.check(token);
    if (checkResult.isErr()) {
      return err(checkResult.error);
    }
    const { metadata, user } = checkResult.value;

    const blacklistResult = await deps.sessionBlacklistPort.isBlacklisted(
      metadata.id,
    );
    if (blacklistResult.isErr()) {
      return err(blacklistResult.error);
    }
    if (blacklistResult.value) {
      return err(new ForbiddenError());
    }

    return ok({ active: true, user });
  };
