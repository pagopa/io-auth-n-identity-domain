import {
  ConflictError,
  ForbiddenError,
  GenericError,
  NotFoundError,
  ValidationError,
} from "@pagopa/hexagonal-core";
import { ResultAsync } from "neverthrow";

import {
  ActivatePubKeyPayloadSchema,
  ActivatedPubKeySchema,
  GenerateLcParamsPayloadSchema,
  LcParamsSchema,
  NewPubKeyPayloadSchema,
  NewPubKeySchema,
} from "../../entities/lollipop/lollipop-pub-key.entity.js";
import { LollipopAssertionRef } from "../../value-objects/lollipop/lollipop-assertion-ref.value-object.js";

export interface LollipopClientI {
  readonly reservePubKey: (
    payload: NewPubKeyPayloadSchema,
  ) => ResultAsync<
    NewPubKeySchema,
    GenericError | ValidationError | ForbiddenError | ConflictError
  >;

  readonly activatePubKey: (
    assertionRef: LollipopAssertionRef,
    payload: ActivatePubKeyPayloadSchema,
  ) => ResultAsync<
    ActivatedPubKeySchema,
    GenericError | ValidationError | ForbiddenError
  >;

  readonly generateLCParams: (
    assertionRef: LollipopAssertionRef,
    payload: GenerateLcParamsPayloadSchema,
  ) => ResultAsync<
    LcParamsSchema,
    GenericError | ValidationError | ForbiddenError | NotFoundError
  >;
}
