import {
  AuthenticationError,
  GenericError,
  UseCase,
  ValidationError,
} from "@pagopa/hexagonal-core";
import type {
  LollipopActivationPort,
  PlainSessionToken,
  SessionId,
  SessionPort,
} from "@pagopa/io-auth-n-identity-session";
import {
  toExtendedPlainZendeskSSOToken,
  toHashedSessionToken,
  toPlainBpdSSOToken,
  toPlainFimsSSOToken,
  toPlainWalletSSOToken,
} from "@pagopa/io-auth-n-identity-session";
import { err, ok } from "neverthrow";

import {
  FieldsQueryParam,
  GetSessionOutputDTO,
} from "../../adapters/inbound/dtos/get-session.dto.js";
import { ProfilePort } from "../../domain/ports/outbound/profile.port.js";

type GetSessionUseCaseDeps = {
  sessionPort: SessionPort;
  lollipopActivationPort: LollipopActivationPort;
  profilePort: ProfilePort;
};

export type GetSessionInput = {
  sessionId: SessionId;
  sessionToken: PlainSessionToken;
  fieldsFilter: FieldsQueryParam;
};

type GetSessionOutput = GetSessionOutputDTO;

export const makeGetSessionUseCase =
  (
    deps: GetSessionUseCaseDeps,
  ): UseCase<
    GetSessionInput,
    GetSessionOutput,
    ValidationError | AuthenticationError | GenericError
  > =>
  async (input) => {
    // FIXME: move token validation/introspection to a dedicated middleware
    const maybeSession = await deps.sessionPort.findBySessionToken({
      hashedSessionToken: toHashedSessionToken(input.sessionToken),
      sessionId: input.sessionId,
    });
    if (maybeSession.isErr()) {
      switch (maybeSession.error.kind) {
        case "NotFoundError":
          // TODO: log the underlying error for debugging purposes
          return err(new AuthenticationError());
        case "GenericError":
          // TODO: log the underlying error for debugging purposes
          return err(
            new GenericError("An error occurred while retrieving the session"),
          );
        default: {
          const _exhaustiveCheck: never = maybeSession.error;
          return err(
            new GenericError(
              "An unexpected error occurred while retrieving the session",
            ),
          );
        }
      }
    }

    const sessionData: GetSessionOutput = {};
    for (const field of input.fieldsFilter) {
      switch (field) {
        case "spidLevel":
          sessionData.spidLevel = maybeSession.value.spidLevel;
          break;
        case "expirationDate":
          sessionData.expirationDate = maybeSession.value.expirationDate;
          break;
        case "lollipopAssertionRef": {
          const maybeLollipopActivation =
            await deps.lollipopActivationPort.getByFiscalCode(
              maybeSession.value.fiscalCode,
            );
          if (maybeLollipopActivation.isErr()) {
            // TODO: log the underlying error for debugging purposes
            return err(
              new GenericError(
                "An error occurred while retrieving the lollipop activation",
              ),
            );
          }
          sessionData.lollipopAssertionRef =
            maybeLollipopActivation.value.assertionRef;
          break;
        }
        case "walletToken":
          sessionData.walletToken = toPlainWalletSSOToken(input.sessionToken);
          break;
        case "bpdToken":
          sessionData.bpdToken = toPlainBpdSSOToken(input.sessionToken);
          break;
        case "zendeskToken":
          const maybeProfile = await deps.profilePort.getProfile(
            maybeSession.value.fiscalCode,
          );
          const validEmail =
            maybeProfile.isOk() &&
            maybeProfile.value.email &&
            maybeProfile.value.isEmailValidated
              ? maybeProfile.value.email
              : undefined;
          sessionData.zendeskToken = await toExtendedPlainZendeskSSOToken(
            input.sessionToken,
            validEmail,
          );
          break;
        case "fimsToken":
          sessionData.fimsToken = toPlainFimsSSOToken(input.sessionToken);
          break;
        default: {
          const _exhaustiveCheck: never = field;
          throw new GenericError(
            "An unexpected error occurred while retrieving the session field data",
          );
        }
      }
    }

    return ok(sessionData);
  };
