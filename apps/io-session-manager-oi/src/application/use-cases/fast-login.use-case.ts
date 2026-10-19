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

import { BlockedUsersPort } from "../../domain/ports/outbound/blocked-users.port.js";
import { FastLoginPort } from "../../domain/ports/outbound/fast-login.port.js";
import type { FastLoginParams } from "../../domain/value-objects/fast-login.vo.js";

import type { GenerateFastLoginLollipopParamsUseCase } from "./generate-fast-login-lollipop-params.use-case.js";
import type {
  RefreshUserSessionUseCase,
  SessionInfo,
} from "./refresh-user-session.use-case.js";

const ASSERTION_NAMESPACE = "urn:oasis:names:tc:SAML:2.0:assertion";
const DEFAULT_SPID_LEVEL = "https://www.spid.gov.it/SpidL2";

type FastLoginHeaders = {
  "x-pagopa-lollipop-original-method": FastLoginParams["originalMethod"];
  "x-pagopa-lollipop-original-url": FastLoginParams["originalUrl"];
  "signature-input": FastLoginParams["signatureInput"];
  signature: FastLoginParams["signature"];
};

type FastLoginInput = {
  headers: FastLoginHeaders;
  clientIp: FastLoginParams["clientIp"];
  currentUser?: FastLoginParams["userId"];
};

type FastLoginOutput = { token: NonEmptyString };

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
    blockedUsersPort: BlockedUsersPort;
    generateFastLoginLollipopParamsUseCase: GenerateFastLoginLollipopParamsUseCase;
    refreshUserSessionUseCase: RefreshUserSessionUseCase;
    enabled: boolean;
  }): UseCase<
    FastLoginInput,
    FastLoginOutput,
    AuthenticationError | ForbiddenError | GenericError | ValidationError
  > =>
  async ({ headers, clientIp, currentUser }) => {
    if (!deps.enabled) {
      return err(new ForbiddenError());
    }

    const lollipopResult = await deps.generateFastLoginLollipopParamsUseCase({
      signatureInput: headers["signature-input"],
      ...(currentUser ? { currentUser } : {}),
    });
    if (lollipopResult.isErr()) {
      return err(lollipopResult.error);
    }
    const lollipop = lollipopResult.value;

    const fastLoginResult = await deps.fastLoginPort.fastLogin({
      originalMethod: headers["x-pagopa-lollipop-original-method"],
      originalUrl: headers["x-pagopa-lollipop-original-url"],
      signature: headers.signature,
      signatureInput: headers["signature-input"],
      assertionRef: lollipop.assertionRef,
      assertionType: lollipop.assertionType,
      authJWT: lollipop.authJWT,
      clientIp,
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

    const blockedUserResult = await deps.blockedUsersPort.isBlocked(
      lollipop.userId,
    );
    if (blockedUserResult.isErr()) {
      return err(
        new GenericError(
          `Error while checking blocked-user status: ${blockedUserResult.error.message}`,
        ),
      );
    }
    if (blockedUserResult.value) {
      return err(new AuthenticationError());
    }

    const sessionResult = await deps.refreshUserSessionUseCase({
      sessionToken: { ...user, ipAddress: clientIp, loginType: "LV" },
    });
    if (sessionResult.isErr()) {
      return err(sessionResult.error);
    }

    return ok({ token: NonEmptyStringSchema.parse(sessionResult.value) });
  };
