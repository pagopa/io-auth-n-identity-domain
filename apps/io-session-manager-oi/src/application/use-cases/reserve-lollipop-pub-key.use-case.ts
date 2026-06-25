import type { UseCase } from "@pagopa/io-core-domain";
import { ConflictError, GenericError } from "@pagopa/io-core-domain/errors";
import { err, ok } from "neverthrow";

import type { LollipopOutboundPort } from "../../domain/ports/outbound/lollipop.js";
import {
  LollipopJwk,
  LollipopJwkHashingAlgorithm,
  LollipopJwkHashingAlgorithmSchema,
} from "@pagopa/io-auth-n-identity-domain";
import { LollipopPublicKey } from "../../domain/entities/lollipop-public-key.entity.js";

const DEFAULT_ALGORITHM = LollipopJwkHashingAlgorithmSchema.parse("sha256");
interface ReserveLollipopPubKeyInput {
  readonly algorithm?: LollipopJwkHashingAlgorithm;
  readonly publicKey: LollipopJwk;
}

export const reserveLollipopPubKeyUseCase =
  (
    lollipopPort: LollipopOutboundPort,
  ): UseCase<
    ReserveLollipopPubKeyInput,
    LollipopPublicKey,
    GenericError | ConflictError
  > =>
  async ({ algorithm = DEFAULT_ALGORITHM, publicKey }) => {
    const reserveResult = await lollipopPort.reservePubKey({
      algorithm,
      publicKey,
    });

    if (reserveResult.isErr()) {
      return err(reserveResult.error);
    }

    return ok(reserveResult.value);
  };
