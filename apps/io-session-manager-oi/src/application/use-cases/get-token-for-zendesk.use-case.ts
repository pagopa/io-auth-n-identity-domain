import {
  GenericError,
  NonEmptyString,
  NotFoundError,
  UnprocessableEntityError,
  UseCase,
} from "@pagopa/hexagonal-core";
import { BaseSession } from "@pagopa/io-auth-n-identity-session";
import * as jwt from "jsonwebtoken";
import { err, ok } from "neverthrow";
import { ulid } from "ulid";

import { ProfilePort } from "../../domain/ports/outbound/profile.port.js";
import { PositiveInteger } from "../../domain/value-objects/positive-integer.vo.js";

export type GetTokenForZendeskInput = {
  session: BaseSession;
};

export type GetTokenForZendeskOutput = {
  jwt: NonEmptyString;
};

export type GetTokenForZendeskError = GenericError | UnprocessableEntityError;

type GetTokenForZendeskDeps = {
  profilePort: ProfilePort;
  jwtZendeskSupportTokenSecret: NonEmptyString;
  jwtZendeskSupportTokenExpiration: PositiveInteger;
  jwtZendeskSupportTokenIssuer: NonEmptyString;
};

export type GetTokenForZendeskUseCase = UseCase<
  GetTokenForZendeskInput,
  GetTokenForZendeskOutput,
  GetTokenForZendeskError
>;

export const makeGetTokenForZendeskUseCase =
  (deps: GetTokenForZendeskDeps): GetTokenForZendeskUseCase =>
  async ({ session }: GetTokenForZendeskInput) => {
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
    if (!profile.isEmailValidated || !profile.email) {
      return err(
        new UnprocessableEntityError(
          "Zendesk support email is not validated",
        ),
      );
    }

    try {
      const token = jwt.sign(
        {
          email: profile.email,
          external_id: session.fiscalCode,
          iat: Date.now() / 1000,
          jti: ulid(),
          name: `${session.name} ${session.familyName}`,
        },
        deps.jwtZendeskSupportTokenSecret,
        {
          algorithm: "HS256",
          expiresIn: deps.jwtZendeskSupportTokenExpiration,
          issuer: deps.jwtZendeskSupportTokenIssuer,
        },
      );

      return ok({ jwt: token as NonEmptyString });
    } catch (cause) {
      return err(
        new GenericError(
          cause instanceof Error
            ? cause.message
            : "Error generating Zendesk support token",
        ),
      );
    }
  };
