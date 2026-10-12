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
import { ZendeskConfig } from "../../domain/value-objects/configs/zendesk.vo.js";

export type GetTokenForZendeskInput = {
  session: BaseSession;
};

export type GetTokenForZendeskOutput = {
  jwt: NonEmptyString;
};

export type GetTokenForZendeskError = GenericError | UnprocessableEntityError;

type GetTokenForZendeskDeps = {
  profilePort: ProfilePort;
  config: Omit<ZendeskConfig, "ALLOW_ZENDESK_IP_SOURCE_RANGE">
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
      // TODO: use `UnprocessableEntityError` instead of `GenericError` after downstream services support it
      return err(
        new GenericError(
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
        deps.config.JWT_ZENDESK_SUPPORT_TOKEN_SECRET,
        {
          algorithm: "HS256",
          expiresIn: deps.config.JWT_ZENDESK_SUPPORT_TOKEN_EXPIRATION,
          issuer: deps.config.JWT_ZENDESK_SUPPORT_TOKEN_ISSUER,
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
