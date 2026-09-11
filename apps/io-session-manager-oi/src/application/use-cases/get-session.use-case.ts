import {
  AuthenticationError,
  GenericError,
  UseCase,
  ValidationError,
} from "@pagopa/hexagonal-core";
import type {
  BaseSession,
  LollipopActivationPort,
  PlainSessionToken,
  SessionId,
  SessionPort,
} from "@pagopa/io-auth-n-identity-session";
import {
  toExtendedPlainZendeskSSOToken,
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
  session: BaseSession;
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
    const sessionData: GetSessionOutput = {};
    for (const field of input.fieldsFilter) {
      switch (field) {
        case "spidLevel":
          sessionData.spidLevel = input.session.spidLevel;
          break;
        case "expirationDate":
          sessionData.expirationDate = input.session.expirationDate;
          break;
        case "lollipopAssertionRef": {
          const maybeLollipopActivation =
            await deps.lollipopActivationPort.getByFiscalCode(
              input.session.fiscalCode,
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
            input.session.fiscalCode,
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
          return err(
            new GenericError(
              "An unexpected error occurred while retrieving the session field data",
            ),
          );
        }
      }
    }

    return ok(sessionData);
  };
