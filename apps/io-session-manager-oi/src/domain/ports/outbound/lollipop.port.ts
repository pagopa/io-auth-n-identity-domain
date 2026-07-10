import {
  type ConflictError,
  type ForbiddenError,
  type GenericError,
  type NotFoundError,
  type ValidationError,
} from "@pagopa/hexagonal-core";
import { type LollipopAssertionRef } from "@pagopa/io-auth-n-identity-domain";
import { Result } from "neverthrow";

import {
  ActivatePubKeyPayloadSchema,
  GenerateLcParamsPayloadSchema,
  LcParamsSchema,
  NewPubKeyPayloadSchema,
} from "../../entities/lollipop.entity.js";

export interface LollipopPort {
  readonly reservePubKey: (
    payload: NewPubKeyPayloadSchema,
  ) => Promise<
    Result<
      undefined,
      GenericError | ValidationError | ForbiddenError | ConflictError
    >
  >;

  readonly activatePubKey: (
    assertionRef: LollipopAssertionRef,
    payload: ActivatePubKeyPayloadSchema,
  ) => Promise<
    Result<
      LollipopAssertionRef,
      GenericError | ValidationError | ForbiddenError
    >
  >;

  readonly generateLCParams: (
    assertionRef: LollipopAssertionRef,
    payload: GenerateLcParamsPayloadSchema,
  ) => Promise<
    Result<
      LcParamsSchema,
      GenericError | ValidationError | ForbiddenError | NotFoundError
    >
  >;
}
