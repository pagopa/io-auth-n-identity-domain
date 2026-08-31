import {
  AuthenticationError,
  FiscalCode,
  GenericError,
  NonEmptyString,
  NotFoundError,
  UseCase,
} from "@pagopa/hexagonal-core";
import { SessionPort } from "@pagopa/io-auth-n-identity-session/ports";
import {
  PlainBpdSSOTokenSchema,
  SessionIdSchema,
  toHashedBpdSSOToken,
} from "@pagopa/io-auth-n-identity-session/value-objects";
import { err, ok } from "neverthrow";

import { BearerAuthorizationHeaderSchema } from "../../domain/value-objects/bearer-authorization-header.vo.js";
import { BpdClientSessionTokenSchema } from "../../domain/value-objects/bpd-client-session-token.vo.js";

export type GetUserForBpdInput = {
  authorizationHeader: string | undefined;
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

export const makeGetUserForBpdUseCase =
  (sessions: SessionPort): GetUserForBpdUseCase =>
  async ({ authorizationHeader }) => {
    const bearer =
      BearerAuthorizationHeaderSchema.safeParse(authorizationHeader);
    if (!bearer.success) {
      return err(new AuthenticationError());
    }

    const token = BpdClientSessionTokenSchema.safeParse(bearer.data);
    if (!token.success) {
      return err(new AuthenticationError());
    }

    const separatorIndex = token.data.lastIndexOf(".");

    const sessionIdResult = SessionIdSchema.safeParse(
      token.data.slice(0, separatorIndex),
    );
    const plainBpdSSOTokenResult = PlainBpdSSOTokenSchema.safeParse(
      token.data.slice(separatorIndex + 1),
    );

    // Sanity check: unreachable if `BpdClientSessionTokenSchema` matched.
    if (!sessionIdResult.success || !plainBpdSSOTokenResult.success) {
      return err(
        new GenericError(
          "BpdClientSessionToken shape parsed but sub-schemas rejected",
        ),
      );
    }

    const lookup = await sessions.findByBpdToken({
      sessionId: sessionIdResult.data,
      hashedBPDSSOToken: toHashedBpdSSOToken(plainBpdSSOTokenResult.data),
    });

    if (lookup.isErr()) {
      if (lookup.error instanceof NotFoundError) {
        return err(new AuthenticationError());
      }
      return err(lookup.error);
    }

    const session = lookup.value;
    return ok({
      name: session.name,
      family_name: session.familyName,
      fiscal_code: session.fiscalCode,
    });
  };
