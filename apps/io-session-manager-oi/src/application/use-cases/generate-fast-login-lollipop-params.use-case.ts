import {
  ForbiddenError,
  FiscalCode,
  GenericError,
  NonEmptyString,
  NonEmptyStringSchema,
  NotFoundError,
  UseCase,
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

import { LcParamsDto } from "../../adapters/outbound/dtos/io-lollipop.dto.js";
import type { LollipopPort } from "../../domain/ports/outbound/lollipop.port.js";
import {
  FastLoginLollipopParams,
  FastLoginLollipopParamsSchema,
} from "../../domain/value-objects/fast-login.vo.js";

const ASSERTION_HASH_ALGORITHMS = ["sha256", "sha384", "sha512"] as const;
const SIGNATURE_KEY_ID_REGEX = /(?:^|;)\s*keyid="([A-Za-z0-9_=-]+)"/;
const SIGNATURE_NONCE_REGEX = /(?:^|;)\s*nonce="([^"]+)"/;

type GenerateLcParamsInput = {
  keyThumbprint: NonEmptyString;
  operationId: NonEmptyString;
  currentUser?: FiscalCode;
};

type GenerateLcParamsForUserInput = GenerateLcParamsInput & {
  currentUser: FiscalCode;
};

type GenerateLcParamsForAnonymousUserInput = GenerateLcParamsInput & {
  currentUser?: never;
};

// TODO: the Lollipop Port return type should a domain type instead of a DTO.
// It should be fixed in the Lollipop Port implementation and then this Use Case can be updated accordingly.
type LcParams = LcParamsDto;

export type GenerateFastLoginLollipopParamsInput = {
  signatureInput: LollipopSignatureInput;
  currentUser?: FiscalCode;
};

export type GenerateFastLoginLollipopParamsUseCase = UseCase<
  GenerateFastLoginLollipopParamsInput,
  FastLoginLollipopParams,
  ForbiddenError | GenericError | ValidationError
>;

type Dependencies = {
  lollipopPort: LollipopPort;
  lollipopActivationPort: LollipopActivationPort;
};

/**
 * Extracts the Lollipop key thumbprint from the signed request parameters.
 *
 * @param signatureInput The signature-input header from the request.
 * @returns The key thumbprint, or undefined when the key ID is missing or invalid.
 */
const getKeyThumbprint = (
  signatureInput: LollipopSignatureInput,
): NonEmptyString | undefined => {
  const result = NonEmptyStringSchema.safeParse(
    SIGNATURE_KEY_ID_REGEX.exec(signatureInput)?.[1],
  );
  return result.success ? result.data : undefined;
};

/**
 * Extracts the operation ID from the signed request, generating one when absent.
 *
 * @param signatureInput The signature-input header from the request.
 * @returns The nonce or a generated operation ID.
 */
const getOperationId = (
  signatureInput: LollipopSignatureInput,
): NonEmptyString =>
  NonEmptyStringSchema.parse(
    // Reuse the signed nonce as Lollipop's operation ID; generate one if absent.
    SIGNATURE_NONCE_REGEX.exec(signatureInput)?.[1] ?? ulid(),
  );

/**
 * Generates candidate assertion references for each supported hash algorithm.
 *
 * @param keyThumbprint The thumbprint of the key used in the assertion.
 * @returns The valid assertion references that can be queried in Lollipop.
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
 * Retrieves a user's activation and confirms its assertion reference belongs
 * to the key thumbprint from this request.
 *
 * @param keyThumbprint The thumbprint of the key used in the signed request.
 * @param fiscalCode The fiscal code whose activation is being checked.
 * @param lollipopActivationPort The port used to retrieve activation data.
 * @returns The matching activation, or an authorization/upstream error.
 */
const getLollipopActivation = async (
  keyThumbprint: NonEmptyString,
  fiscalCode: FiscalCode,
  lollipopActivationPort: LollipopActivationPort,
): Promise<Result<LollipopActivation, ForbiddenError | GenericError>> => {
  const activationResult =
    await lollipopActivationPort.getByFiscalCode(fiscalCode);
  if (activationResult.isErr()) {
    // Do not reveal whether an activation exists for a different key.
    return err(
      activationResult.error instanceof NotFoundError
        ? new ForbiddenError()
        : activationResult.error,
    );
  }

  const activation = activationResult.value;
  if (
    !ASSERTION_HASH_ALGORITHMS.some(
      (algorithm) =>
        `${algorithm}-${keyThumbprint}` === activation.assertionRef,
    )
  ) {
    return err(new ForbiddenError());
  }

  return ok(activation);
};

/**
 * Converts Lollipop LC parameters into the values required by Fast Login.
 *
 * @param lcParams The parameters returned by Lollipop.
 * @param userId The validated current user, when the caller is authenticated.
 * @returns Fast Login Lollipop parameters, or a validation error.
 */
const toFastLoginLollipopParams = (
  lcParams: LcParams,
  userId: FiscalCode = lcParams.fiscal_code,
): Result<FastLoginLollipopParams, GenericError> => {
  // Convert the upstream DTO and pin the user ID for authenticated requests.
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
 * Creates the LC-parameter generation function for a signed-in user.
 *
 * @param deps - Ports used to retrieve activation data and LC parameters.
 * @returns A function that generates LC parameters for the user's stored key.
 */
const makeGenerateLcParamsForUser =
  (deps: Dependencies) =>
  /**
   * Generates LC parameters after checking the user's stored activation.
   *
   * @param input - The key thumbprint, operation ID, and current user.
   * @returns The LC parameters, or an authentication/upstream error.
   */
  async (
    input: GenerateLcParamsForUserInput,
  ): Promise<Result<LcParams, ForbiddenError | GenericError>> => {
    // Signed-in users must use the key in their own stored activation.
    const activationResult = await getLollipopActivation(
      input.keyThumbprint,
      input.currentUser,
      deps.lollipopActivationPort,
    );
    if (activationResult.isErr()) {
      return err(activationResult.error);
    }

    const assertionRef = LollipopAssertionRefSchema.parse(
      activationResult.value.assertionRef,
    );
    const lcParamsResult = await deps.lollipopPort.generateLCParams(
      assertionRef,
      { operation_id: input.operationId },
    );
    if (lcParamsResult.isErr()) {
      return err(
        lcParamsResult.error instanceof NotFoundError
          ? new ForbiddenError()
          : lcParamsResult.error,
      );
    }

    const lcParams = lcParamsResult.value;
    // Check both values returned by Lollipop before using its credentials.
    if (lcParams.assertion_ref !== assertionRef) {
      return err(
        new GenericError("Lollipop returned a mismatched assertion reference"),
      );
    }
    if (lcParams.fiscal_code !== input.currentUser) {
      return err(
        new GenericError("Lollipop returned a mismatched fiscal code"),
      );
    }

    return ok(lcParams);
  };

/**
 * Creates the LC-parameter generation function for anonymous users.
 *
 * @param deps - Ports used to retrieve LC parameters and activation data.
 * @returns A function that tries each supported assertion reference.
 */
const makeGenerateLcParamsForAnonymousUser =
  (deps: Dependencies) =>
  /**
   * Tries each supported assertion reference and returns the generated LC params.
   *
   * @param input - The key thumbprint and operation ID.
   * @returns The LC parameters, or an authentication/upstream error.
   */
  async (
    input: GenerateLcParamsForAnonymousUserInput,
  ): Promise<Result<LcParams, ForbiddenError | GenericError>> => {
    // Anonymous requests do not identify an assertion hash algorithm, so try
    // each supported reference until Lollipop recognizes one.
    for (const assertionRef of generatePossibleAssertionRefs(
      input.keyThumbprint,
    )) {
      const lcParamsResult = await deps.lollipopPort.generateLCParams(
        assertionRef,
        { operation_id: input.operationId },
      );
      if (lcParamsResult.isErr()) {
        if (lcParamsResult.error instanceof NotFoundError) {
          // A missing reference only rules out this hash algorithm.
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
      // Confirm the generated assertion still matches the stored activation.
      if (activationResult.value.assertionRef !== lcParams.assertion_ref) {
        return err(new ForbiddenError());
      }

      return ok(lcParams);
    }

    return err(new ForbiddenError());
  };

/**
 * Generates LC parameters for the current request, handling signed-in and
 * anonymous users with their respective key-selection rules.
 *
 * @param deps - Ports used to generate LC parameters and retrieve activations.
 * @returns A function that returns Fast Login Lollipop parameters.
 */
const makeGenerateLcParams =
  (deps: Dependencies) =>
  /**
   * Generates LC parameters for the current request.
   *
   * @param input - The optional current user, key thumbprint, and operation ID.
   * @returns The generated Fast Login Lollipop parameters, or an error.
   */
  async (
    input: GenerateLcParamsInput,
  ): Promise<
    Result<FastLoginLollipopParams, ForbiddenError | GenericError>
  > => {
    // Use the authenticated user's fiscal code when available; anonymous calls
    // have to discover the assertion reference from the signed key thumbprint.
    const result = input.currentUser
      ? await makeGenerateLcParamsForUser(deps)({
          ...input,
          currentUser: input.currentUser,
        })
      : await makeGenerateLcParamsForAnonymousUser(deps)({
          keyThumbprint: input.keyThumbprint,
          operationId: input.operationId,
        });

    return result.isErr()
      ? err(result.error)
      : toFastLoginLollipopParams(result.value, input.currentUser);
  };

/**
 * Creates the use case that generates Fast Login Lollipop parameters from the
 * signed request.
 *
 * @param deps - Dependencies required by the use case.
 * @returns The use case function.
 */
export const makeGenerateFastLoginLollipopParamsUseCase =
  (deps: Dependencies): GenerateFastLoginLollipopParamsUseCase =>
  async ({ signatureInput, currentUser }) => {
    const keyThumbprint = getKeyThumbprint(signatureInput);
    if (!keyThumbprint) {
      return err(
        new ValidationError("Missing Lollipop key id in signature-input."),
      );
    }

    return makeGenerateLcParams(deps)({
      keyThumbprint,
      operationId: getOperationId(signatureInput),
      ...(currentUser ? { currentUser } : {}),
    });
  };
