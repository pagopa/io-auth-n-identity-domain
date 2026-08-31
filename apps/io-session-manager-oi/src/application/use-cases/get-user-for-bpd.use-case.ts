import {
  FiscalCode,
  GenericError,
  NonEmptyString,
  NotFoundError,
  UseCase,
  ValidationError,
} from "@pagopa/hexagonal-core";
import { SessionPort } from "@pagopa/io-auth-n-identity-session/ports";
import {
  type PlainBpdSSOToken,
  PlainBpdSSOTokenSchema,
  type SessionId,
  SessionIdSchema,
  toHashedBpdSSOToken,
} from "@pagopa/io-auth-n-identity-session/value-objects";
import { err, ok } from "neverthrow";

import { BpdClientSessionTokenSchema } from "../../domain/value-objects/bpd-client-session-token.vo.js";

export type GetUserForBpdInput = {
  bpdClientSessionToken: string;
};

export type GetUserForBpdOutput = {
  name: NonEmptyString;
  family_name: NonEmptyString;
  fiscal_code: FiscalCode;
};

export type GetUserForBpdError = ValidationError | NotFoundError | GenericError;

export type GetUserForBpdUseCase = UseCase<
  GetUserForBpdInput,
  GetUserForBpdOutput,
  GetUserForBpdError
>;

export const makeGetUserForBpdUseCase =
  (sessions: SessionPort): GetUserForBpdUseCase =>
  async ({ bpdClientSessionToken }) => {
    const validation = BpdClientSessionTokenSchema.safeParse(
      bpdClientSessionToken,
    );
    if (!validation.success) {
      return err(new ValidationError("Invalid BPD client session token"));
    }

    const separatorIndex = validation.data.lastIndexOf(".");

    const sessionId: SessionId = SessionIdSchema.parse(
      validation.data.slice(0, separatorIndex),
    );
    const plainBpdSSOToken: PlainBpdSSOToken = PlainBpdSSOTokenSchema.parse(
      validation.data.slice(separatorIndex + 1),
    );

    // Sanity check
    if (!sessionId || !plainBpdSSOToken) {
      return err(new ValidationError("Invalid BPD client session token"));
    }

    const lookup = await sessions.findByBpdToken({
      sessionId,
      hashedBPDSSOToken: toHashedBpdSSOToken(plainBpdSSOToken),
    });

    if (lookup.isErr()) {
      return err(lookup.error);
    }

    const session = lookup.value;
    return ok({
      name: session.name,
      family_name: session.familyName,
      fiscal_code: session.fiscalCode,
    });
  };
