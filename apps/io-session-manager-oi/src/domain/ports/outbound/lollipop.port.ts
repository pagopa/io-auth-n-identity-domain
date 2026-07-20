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
  ActivatePubKeyPayloadDto,
  GenerateLcParamsPayloadDto,
  LcParamsDto,
  NewPubKeyPayloadDto,
} from "../../../adapters/outbound/dtos/io-lollipop.dto.js";

export interface LollipopPort {
  readonly reservePubKey: (
    payload: NewPubKeyPayloadDto,
  ) => Promise<
    Result<
      undefined,
      GenericError | ValidationError | ForbiddenError | ConflictError
    >
  >;

  readonly activatePubKey: (
    assertionRef: LollipopAssertionRef,
    payload: ActivatePubKeyPayloadDto,
  ) => Promise<
    Result<
      LollipopAssertionRef,
      GenericError | ValidationError | ForbiddenError
    >
  >;

  readonly generateLCParams: (
    assertionRef: LollipopAssertionRef,
    payload: GenerateLcParamsPayloadDto,
  ) => Promise<
    Result<
      LcParamsDto,
      GenericError | ValidationError | ForbiddenError | NotFoundError
    >
  >;
}
