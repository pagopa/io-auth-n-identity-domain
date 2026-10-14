import {
  FiscalCode,
  ForbiddenError,
  GenericError,
  HttpRequestMiddleware,
  NonEmptyString,
  NonEmptyStringSchema,
  NotFoundError,
  ValidationError,
} from "@pagopa/hexagonal-core";
import {
  LollipopAssertionRef,
  LollipopAssertionRefSchema,
  LollipopSignatureInput,
} from "@pagopa/io-auth-n-identity-domain";
import type { LollipopActivation } from "@pagopa/io-auth-n-identity-session";
import type { LollipopActivationPort } from "@pagopa/io-auth-n-identity-session/ports";
import { err, ok, type Result } from "neverthrow";
import { ulid } from "ulid";

import { LollipopPort } from "../../../../domain/ports/outbound/lollipop.port.js";
import {
  FastLoginLollipopParams,
  FastLoginLollipopParamsSchema,
} from "../../../../domain/value-objects/fast-login.vo.js";
import type {
  AuthenticationContext,
  OptionalAuthenticationContext,
} from "../../../../middlewares/authentication/index.js";
import type { LcParamsDto } from "../../../outbound/dtos/io-lollipop.dto.js";
import { FastLoginInputDTO } from "../../dtos/fast-login.dto.js";

const SIGNATURE_KEY_ID_REGEX = /(?:^|;)\s*keyid="([A-Za-z0-9_=-]+)"/;
const SIGNATURE_NONCE_REGEX = /(?:^|;)\s*nonce="([^"]+)"/;
const ASSERTION_HASH_ALGORITHMS = ["sha256", "sha384", "sha512"] as const;

export type FastLoginLollipopContext = {
  lollipop: FastLoginLollipopParams;
};

const getKeyThumbprint = (
  signatureInput: LollipopSignatureInput,
): NonEmptyString | undefined => {
  const result = NonEmptyStringSchema.safeParse(
    SIGNATURE_KEY_ID_REGEX.exec(signatureInput)?.[1],
  );
  return result.success ? result.data : undefined;
};

const getOperationId = (signatureInput: string): NonEmptyString =>
  NonEmptyStringSchema.parse(
    SIGNATURE_NONCE_REGEX.exec(signatureInput)?.[1] ?? ulid(),
  );

/**
 * Generates all possible assertion references for a given key thumbprint.
 *
 * @param keyThumbprint The thumbprint of the key used in the assertion.
 * @returns An array of possible assertion references.
 */
const generatePossibleAssertionRefs = (
  keyThumbprint: NonEmptyString,
): ReadonlyArray<LollipopAssertionRef> =>
  ASSERTION_HASH_ALGORITHMS.flatMap((algorithm) => {
    const result = LollipopAssertionRefSchema.safeParse(
      `${algorithm}-${keyThumbprint}`,
    );
    return result.success ? [result.data] : [];
  });

/**
 * Retrieves the Lollipop activation for a given user.
 *
 * This function ensures that the assertion reference stored for the user matches the key thumbprint provided in the request.
 * This function is used internally to validate the assertion reference against the key thumbprint.
 *
 * @param keyThumbprint The thumbprint of the key used in the assertion.
 * @param currentUser The fiscal code of the current user.
 * @param lollipopActivationPort The port to access lollipop activation data.
 * @returns A Result containing the LollipopActivation if found and if the assertion reference matches, or an error otherwise.
 */
const getLollipopActivation = async (
  keyThumbprint: NonEmptyString,
  currentUser: FiscalCode,
  lollipopActivationPort: LollipopActivationPort,
): Promise<
  Result<LollipopActivation, ForbiddenError | NotFoundError | GenericError>
> => {
  const lollipopActivationResult =
    await lollipopActivationPort.getByFiscalCode(currentUser);

  if (lollipopActivationResult.isErr()) {
    return err(lollipopActivationResult.error);
  }

  const storedAssertionRef = lollipopActivationResult.value.assertionRef;
  if (
    !ASSERTION_HASH_ALGORITHMS.some(
      (algorithm) => `${algorithm}-${keyThumbprint}` === storedAssertionRef,
    )
  ) {
    return err(new ForbiddenError());
  }
  return ok(lollipopActivationResult.value);
};

type FastLoginLcParamsDeps = {
  lollipopPort: LollipopPort;
  lollipopActivationPort: LollipopActivationPort;
};

type ResolveLcParamsInput = {
  keyThumbprint: NonEmptyString;
  operationId: NonEmptyString;
  currentUser?: FiscalCode;
};

type ResolveLcParamsForUserInput = ResolveLcParamsInput & {
  currentUser: FiscalCode;
};

type ResolveLcParamsForAnonymousUserInput = ResolveLcParamsInput & {
  currentUser?: never;
};

const toFastLoginLollipopParams = (
  lcParams: LcParamsDto,
  userId: FiscalCode = lcParams.fiscal_code,
): Result<FastLoginLollipopParams, GenericError> => {
  const parsed = FastLoginLollipopParamsSchema.safeParse({
    assertionRef: lcParams.assertion_ref,
    assertionType: lcParams.assertion_type,
    authJWT: lcParams.lc_authentication_bearer,
    userId,
    publicKey: lcParams.pub_key,
  });
  return parsed.success
    ? ok(parsed.data)
    : err(new GenericError("Invalid Lollipop parameters for Fast Login"));
};

/**
 * Creates a resolver for LC parameters belonging to a signed-in user.
 *
 * @param deps - Ports used to retrieve activation data and LC parameters.
 * @returns A resolver that takes the signature key thumbprint, operation ID,
 *   and current user's fiscal code.
 */
const makeResolveLcParamsForUser =
  (deps: FastLoginLcParamsDeps) =>
  /**
   * Resolves LC parameters after verifying the user's stored assertion reference
   * matches the signature key.
   *
   * @param input - The key thumbprint, operation ID, and current user.
   * @returns The LC parameters, or an authentication/upstream error.
   */
  async (
    input: ResolveLcParamsForUserInput,
  ): Promise<
    Result<LcParamsDto, ForbiddenError | NotFoundError | GenericError>
  > => {
    const lollipopActivationResult = await getLollipopActivation(
      input.keyThumbprint,
      input.currentUser,
      deps.lollipopActivationPort,
    );
    if (lollipopActivationResult.isErr()) {
      return err(lollipopActivationResult.error);
    }
    const lollipopActivation = lollipopActivationResult.value;

    // Generate the LC parameters for the user based on the stored assertion reference.
    // TODO: fix port to return a domain-specific result type instead of a DTO
    const lcParamsResult = await deps.lollipopPort.generateLCParams(
      LollipopAssertionRefSchema.parse(lollipopActivation.assertionRef),
      { operation_id: NonEmptyStringSchema.parse(input.operationId) },
    );
    if (lcParamsResult.isErr()) {
      return err(lcParamsResult.error);
    }
    const lcParams = lcParamsResult.value;

    // Ensure that the assertion reference returned by Lollipop matches the stored one.
    if (lcParams.assertion_ref !== lollipopActivation.assertionRef) {
      return err(
        new GenericError("Lollipop returned a mismatched assertion reference"),
      );
    }
    // Ensure that the fiscal code returned by Lollipop matches the current user.
    if (lcParams.fiscal_code !== input.currentUser) {
      return err(
        new GenericError("Lollipop returned a mismatched fiscal code"),
      );
    }

    return ok(lcParams);
  };

/**
 * Creates a resolver for LC parameters that works for anonymous users.
 *
 * @param deps - Ports used to retrieve activation data and LC parameters.
 * @returns A resolver that takes the signature key thumbprint, operation ID
 */
const makeResolveLcParamsForAnonymousUser =
  (deps: FastLoginLcParamsDeps) =>
  /**
   * Resolves LC parameters for an anonymous user.
   *
   * @param input - The input containing the key thumbprint and operation ID.
   * @returns The resolved LC parameters for the anonymous user.
   */
  async (
    input: ResolveLcParamsForAnonymousUserInput,
  ): Promise<
    Result<LcParamsDto, ForbiddenError | NotFoundError | GenericError>
  > => {
    for (const assertionRef of generatePossibleAssertionRefs(
      input.keyThumbprint,
    )) {
      const lcParamsResult = await deps.lollipopPort.generateLCParams(
        assertionRef,
        { operation_id: NonEmptyStringSchema.parse(input.operationId) },
      );

      if (lcParamsResult.isErr()) {
        if (lcParamsResult.error instanceof NotFoundError) {
          continue;
        }
        return err(lcParamsResult.error);
      }
      const lcParams = lcParamsResult.value;

      if (lcParams.assertion_ref !== assertionRef) {
        return err(
          new GenericError(
            "Lollipop returned a mismatched assertion reference",
          ),
        );
      }

      const activationResult = await getLollipopActivation(
        input.keyThumbprint,
        lcParams.fiscal_code,
        deps.lollipopActivationPort,
      );
      if (activationResult.isErr()) {
        return err(activationResult.error);
      }
      if (activationResult.value.assertionRef !== lcParams.assertion_ref) {
        return err(new ForbiddenError());
      }

      return ok(lcParams);
    }

    return err(new NotFoundError("Lollipop assertion", "Not Found"));
  };

/**
 * Creates a resolver for LC parameters for the current request, handling both authenticated and anonymous users.
 *
 * @param deps - Ports used to retrieve activation data and LC parameters.
 * @returns A resolver that takes the request input and returns the resolved LC parameters.
 */
const makeResolveLcParams =
  (deps: FastLoginLcParamsDeps) =>
  /**
   * Resolves LC parameters for the current request, handling both authenticated and anonymous users.
   *
   * @param input - The input containing the current user (if any), key thumbprint, and operation ID.
   * @returns The resolved LC parameters for the current request.
   */
  async (
    input: ResolveLcParamsInput,
  ): Promise<
    Result<
      FastLoginLollipopParams,
      ForbiddenError | NotFoundError | GenericError
    >
  > => {
    const currentUser = input.currentUser;
    if (currentUser) {
      const result = await makeResolveLcParamsForUser(deps)({
        ...input,
        currentUser,
      });
      return result.isErr()
        ? err(result.error)
        : toFastLoginLollipopParams(result.value, currentUser);
    }

    const result = await makeResolveLcParamsForAnonymousUser(deps)({
      keyThumbprint: input.keyThumbprint,
      operationId: input.operationId,
    });
    if (result.isErr()) {
      return err(result.error);
    }
    return toFastLoginLollipopParams(result.value);
  };

/**
 * Creates the Fast Login Lollipop middleware for handling requests with Lollipop authentication.
 *
 * @param deps - Dependencies required for resolving LC parameters.
 * @returns An HTTP request middleware that processes Lollipop authentication.
 */
export const createFastLoginLollipopMiddleware =
  (
    deps: FastLoginLcParamsDeps,
  ): HttpRequestMiddleware<
    OptionalAuthenticationContext<AuthenticationContext<"session">>,
    FastLoginLollipopContext,
    ForbiddenError | GenericError | ValidationError
  > =>
  /**
   * The Fast Login Lollipop middleware function.
   *
   * @param payload - The HTTP request payload containing headers.
   * @param context - The optional authentication context for the current request.
   * @returns The result of processing the Lollipop authentication, including any errors.
   */
  async ({ payload, context }) => {
    const parsedHeaders = FastLoginInputDTO.headers.safeParse(payload.headers);
    if (!parsedHeaders.success) {
      return err(new ValidationError("Invalid Lollipop request headers."));
    }

    const signatureInput = parsedHeaders.data["signature-input"];
    const keyThumbprint = getKeyThumbprint(signatureInput);
    if (!keyThumbprint) {
      return err(
        new ValidationError("Missing Lollipop key id in signature-input."),
      );
    }

    const currentUser = context.authenticated
      ? context.value.session.fiscalCode
      : undefined;

    const resolved = await makeResolveLcParams(deps)({
      keyThumbprint,
      operationId: getOperationId(signatureInput),
      ...(currentUser ? { currentUser } : {}),
    });

    if (resolved.isErr()) {
      if (resolved.error instanceof NotFoundError) {
        return err(new ForbiddenError());
      }
      return err(resolved.error);
    }

    return ok({ lollipop: resolved.value });
  };
