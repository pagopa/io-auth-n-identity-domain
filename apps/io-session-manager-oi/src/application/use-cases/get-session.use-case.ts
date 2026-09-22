import { GenericError, UseCase } from "@pagopa/hexagonal-core";
import type {
  BaseSession,
  LollipopActivationPort,
  PlainSessionToken,
  SessionPort,
} from "@pagopa/io-auth-n-identity-session";
import {
  toExtendedPlainZendeskSSOToken,
  toPlainBpdSSOToken,
  toPlainFimsSSOToken,
  toPlainPagoPaSSOToken,
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
  sessionToken: PlainSessionToken;
  session: BaseSession;
  fieldsFilter: FieldsQueryParam;
};

type GetSessionOutput = GetSessionOutputDTO;

export const makeGetSessionUseCase =
  (
    deps: GetSessionUseCaseDeps,
  ): UseCase<GetSessionInput, GetSessionOutput, GenericError> =>
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
        case "walletToken": {
          const pagopaToken = toPlainPagoPaSSOToken(input.sessionToken);
          sessionData.walletToken = `${input.session.sessionId}.${pagopaToken}`;
          break;
        }
        case "bpdToken": {
          const bpdToken = toPlainBpdSSOToken(input.sessionToken);
          sessionData.bpdToken = `${input.session.sessionId}.${bpdToken}`;
          break;
        }
        case "zendeskToken": {
          const maybeProfile = await deps.profilePort.getProfile(
            input.session.fiscalCode,
          );
          const validEmail =
            maybeProfile.isOk() &&
            maybeProfile.value.email &&
            maybeProfile.value.isEmailValidated
              ? maybeProfile.value.email
              : undefined;
          const zendeskToken = await toExtendedPlainZendeskSSOToken(
            input.sessionToken,
            validEmail,
          );
          sessionData.zendeskToken = `${input.session.sessionId}.${zendeskToken}`;
          break;
        }
        case "fimsToken": {
          const fimsToken = toPlainFimsSSOToken(input.sessionToken);
          sessionData.fimsToken = `${input.session.sessionId}.${fimsToken}`;
          break;
        }
        default: {
          const _exhaustiveCheck: never = field; // This ensures that all possible fields are handled in the switch statement
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
