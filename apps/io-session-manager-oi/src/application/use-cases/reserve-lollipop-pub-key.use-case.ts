import {
  LollipopPublicKeyHashingAlgorithmSchema,
  type LollipopNewPublicKey,
  type LollipopPublicKey,
  type LollipopPublicKeyHashingAlgorithm,
} from "@pagopa/io-auth-n-identity-domain";
import type { UseCase } from "@pagopa/io-core-domain";
import { ConflictError, GenericError } from "@pagopa/io-core-domain/errors";
import { err, ok } from "neverthrow";

import type { LollipopOutboundPort } from "../../domain/ports/outbound/lollipop.js";

const DEFAULT_ALGORITHM =
  LollipopPublicKeyHashingAlgorithmSchema.parse("sha256");
interface ReserveLollipopPubKeyInput {
  readonly algorithm?: LollipopPublicKeyHashingAlgorithm;
  readonly publicKey: LollipopPublicKey;
}

export const reserveLollipopPubKeyUseCase =
  (
    lollipopPort: LollipopOutboundPort,
  ): UseCase<
    ReserveLollipopPubKeyInput,
    LollipopNewPublicKey,
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
