import {
  AuthenticationError,
  FiscalCode,
  ForbiddenError,
  GenericError,
  NonEmptyString,
  UseCase,
  ValidationError,
} from "@pagopa/hexagonal-core";
import type { Logger } from "@pagopa/hexagonal-core/domain/ports";
import { err, ok } from "neverthrow";

import { ActiveSession } from "../../domain/entitites/active-session.entity.js";
import { SessionPort } from "../../domain/ports/outbound/session.port.js";
import {
  OidcCallbackErrorParams,
  OidcCallbackErrorParamsSchema,
  OidcCallbackSuccessParams,
  OidcCallbackSuccessParamsSchema,
} from "../../domain/value-objects/oidc.vo.js";

export type HandleOidcCallbackInput = {
  callback: OidcCallbackSuccessParams | OidcCallbackErrorParams;
};

export type HandleOidcCallbackDeps = {
  sessionPort: SessionPort;
};

// Business outcome of the callback: a session token on success, or a login
// error code (with an optional message) forwarded to the client error page.
// Both variants are turned into a client redirect by the inbound handler;
// unexpected failures stay on the error channel and become a problem+json.
export type HandleOidcCallbackOutput =
  | { readonly outcome: "success"; readonly token: NonEmptyString }
  | {
      readonly outcome: "error";
      readonly errorCode?: number;
      readonly errorMessage: NonEmptyString;
    };

const parseCallbackQueryParamsError = (
  params: unknown,
): HandleOidcCallbackOutput => {
  const errorDecode = OidcCallbackErrorParamsSchema.safeParse(params);
  let data: HandleOidcCallbackOutput = {
    outcome: "error",
    errorCode: undefined,
    errorMessage: "error occurred" as NonEmptyString,
  };
  if (errorDecode.success) {
    data = {
      ...data,
      errorCode:
        parseInt(errorDecode.data.error_description || "", 10) ?? undefined,
      errorMessage: errorDecode.data.error,
    };
  }

  return data;
};

export const makeHandleOidcCallbackUseCase =
  (
    deps: HandleOidcCallbackDeps,
  ): UseCase<
    HandleOidcCallbackInput,
    HandleOidcCallbackOutput,
    AuthenticationError | ValidationError | ForbiddenError | GenericError
  > =>
  async ({ callback }) => {
    const parametersDecode =
      OidcCallbackSuccessParamsSchema.safeParse(callback);
    if (!parametersDecode.success) {
      return ok(parseCallbackQueryParamsError(callback));
    }

    // TODO: in another PR (IOPID-4305) replace stub data with the user data retrieved from the ID token
    const stubSession: ActiveSession = {
      name: "Mario" as NonEmptyString,
      family_name: "Rossi" as NonEmptyString,
      fiscal_number: "AAAAAA00A00A000A" as FiscalCode,
      spid_level: "https://www.spid.gov.it/SpidL2",
    };
    const errorOrToken = await deps.sessionPort.create(stubSession);
    if (errorOrToken.isErr()) {
      return err(errorOrToken.error);
    }

    return ok({ outcome: "success", token: errorOrToken.value });
  };
