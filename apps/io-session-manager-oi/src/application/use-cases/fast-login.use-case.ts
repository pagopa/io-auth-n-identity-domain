import {
  AuthenticationError,
  EmailAddressSchema,
  FiscalCodeSchema,
  ForbiddenError,
  GenericError,
  NonEmptyStringSchema,
  type NonEmptyString,
  UseCase,
  ValidationError,
} from "@pagopa/hexagonal-core";
import { SpidLevelSchema } from "@pagopa/io-auth-n-identity-session";
import { DOMParser } from "@xmldom/xmldom";
import { err, ok } from "neverthrow";

import { FastLoginPort } from "../../domain/ports/outbound/fast-login.port.js";
import type { FastLoginParams } from "../../domain/value-objects/fast-login.vo.js";

import type { GenerateFastLoginLollipopParamsUseCase } from "./generate-fast-login-lollipop-params.use-case.js";
import type {
  RefreshUserSessionUseCase,
  SessionInfo,
} from "./refresh-user-session.use-case.js";
import type { ValidateProfileLocksUseCase } from "./validate-profile-locks.use-case.js";

const ASSERTION_NAMESPACE = "urn:oasis:names:tc:SAML:2.0:assertion";
const DEFAULT_SPID_LEVEL = "https://www.spid.gov.it/SpidL2";

type FastLoginInput = {
  originalMethod: FastLoginParams["originalMethod"];
  originalUrl: FastLoginParams["originalUrl"];
  signatureInput: FastLoginParams["signatureInput"];
  signature: FastLoginParams["signature"];
  clientIp: FastLoginParams["clientIp"];
};

type FastLoginOutput = { token: NonEmptyString };

export type FastLoginUseCase = UseCase<
  FastLoginInput,
  FastLoginOutput,
  AuthenticationError | ForbiddenError | GenericError | ValidationError
>;

const getAttribute = (
  document: Document,
  name: string,
): NonEmptyString | undefined => {
  const attribute = Array.from(
    document.getElementsByTagNameNS(ASSERTION_NAMESPACE, "Attribute"),
  ).find((element) => element.getAttribute("Name") === name);
  const value = attribute?.textContent?.trim();
  return value ? NonEmptyStringSchema.parse(value) : undefined;
};

type ParsedSamlUser = Omit<SessionInfo, "ipAddress" | "loginType">;

const parseSamlUser = (samlResponse: string): ParsedSamlUser | undefined => {
  const errors: string[] = [];
  const document = new DOMParser({
    errorHandler: {
      warning: (message) => errors.push(String(message)),
      error: (message) => errors.push(String(message)),
      fatalError: (message) => errors.push(String(message)),
    },
  }).parseFromString(samlResponse, "application/xml");

  if (!document.documentElement || errors.length > 0) {
    return undefined;
  }

  const issuer = NonEmptyStringSchema.safeParse(
    document
      .getElementsByTagNameNS(ASSERTION_NAMESPACE, "Issuer")
      .item(0)
      ?.textContent?.trim(),
  );

  const rawFiscalCode = getAttribute(document, "fiscalNumber")
    ?.toUpperCase()
    .replace(/^TINIT-/, "");
  const fiscalCode = FiscalCodeSchema.safeParse(rawFiscalCode);

  const name = NonEmptyStringSchema.safeParse(getAttribute(document, "name"));

  const familyName = NonEmptyStringSchema.safeParse(
    getAttribute(document, "familyName"),
  );

  const rawDateOfBirth = getAttribute(document, "dateOfBirth");
  const dateOfBirth = rawDateOfBirth ? new Date(rawDateOfBirth) : undefined;

  const rawSpidLevel = document
    .getElementsByTagNameNS(ASSERTION_NAMESPACE, "AuthnContextClassRef")
    .item(0)
    ?.textContent?.trim();
  const parsedSpidLevel = SpidLevelSchema.safeParse(rawSpidLevel);

  const spidLevel = parsedSpidLevel.success
    ? parsedSpidLevel.data
    : SpidLevelSchema.parse(DEFAULT_SPID_LEVEL);

  if (
    !issuer.success ||
    !fiscalCode.success ||
    !name.success ||
    !familyName.success ||
    !dateOfBirth ||
    Number.isNaN(dateOfBirth.getTime())
  ) {
    return undefined;
  }

  const email = EmailAddressSchema.safeParse(getAttribute(document, "email"));
  return {
    fiscalCode: fiscalCode.data,
    name: name.data,
    familyName: familyName.data,
    dateOfBirth,
    spidLevel,
    ...(email.success ? { spidEmail: email.data } : {}),
    identityProvider: issuer.data,
  };
};

export const makeFastLoginUseCase =
  (deps: {
    fastLoginPort: FastLoginPort;
    validateProfileLocksUseCase: ValidateProfileLocksUseCase;
    generateFastLoginLollipopParamsUseCase: GenerateFastLoginLollipopParamsUseCase;
    refreshUserSessionUseCase: RefreshUserSessionUseCase;
    enabled: boolean;
  }): FastLoginUseCase =>
  async (input) => {
    if (!deps.enabled) {
      return err(new ForbiddenError());
    }

    const lollipopResult = await deps.generateFastLoginLollipopParamsUseCase({
      signatureInput: input.signatureInput,
    });
    if (lollipopResult.isErr()) {
      return err(lollipopResult.error);
    }
    const lollipop = lollipopResult.value;

    const fastLoginResult = await deps.fastLoginPort.fastLogin({
      originalMethod: input.originalMethod,
      originalUrl: input.originalUrl,
      signature: input.signature,
      signatureInput: input.signatureInput,
      assertionRef: lollipop.assertionRef,
      assertionType: lollipop.assertionType,
      authJWT: lollipop.authJWT,
      clientIp: input.clientIp,
      publicKey: lollipop.publicKey,
      userId: lollipop.userId,
    });
    if (fastLoginResult.isErr()) {
      return err(fastLoginResult.error);
    }

    const user = parseSamlUser(fastLoginResult.value);
    if (!user) {
      return err(
        new GenericError("Could not parse SAML response from Fast Login"),
      );
    }
    if (user.fiscalCode !== lollipop.userId) {
      return err(new AuthenticationError());
    }

    const validateProfileLocksResult = await deps.validateProfileLocksUseCase({
      fiscalCode: user.fiscalCode,
      checks: ["technical"],
    });
    if (validateProfileLocksResult.isErr()) {
      const error = validateProfileLocksResult.error;
      switch (error.kind) {
        case "ForbiddenError":
          return err(new AuthenticationError());
        case "GenericError":
          return err(
            new GenericError(
              `Error while validating profile locks: ${error.message}`,
            ),
          );
        default: {
          const _exhaustiveCheck: never = error;
          return err(new GenericError("Unhandled error"));
        }
      }
    }

    const sessionResult = await deps.refreshUserSessionUseCase({
      sessionToken: { ...user, ipAddress: input.clientIp, loginType: "LV" },
    });
    if (sessionResult.isErr()) {
      return err(sessionResult.error);
    }

    return ok({ token: NonEmptyStringSchema.parse(sessionResult.value) });
  };
