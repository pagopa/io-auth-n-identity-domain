import {
  LollipopPublicKeyHashingAlgorithmSchema,
  LollipopPublicKeyHeadersSchema,
  type LollipopAssertionRef,
  type LollipopPublicKeyHeaders,
} from "@pagopa/io-auth-n-identity-domain";
import type { UseCase } from "@pagopa/io-core-domain";
import {
  ConflictError,
  GenericError,
  ValidationError,
} from "@pagopa/io-core-domain/errors";
import { err, ok } from "neverthrow";

import type { LollipopOutboundPort } from "../../domain/ports/outbound/lollipop.js";

interface ReserveLollipopPubKeyInput {
  readonly headers: Record<string, string | string[] | undefined>;
}

interface ReserveLollipopPubKeyOutput {
  readonly pubKeyHeaders: LollipopPublicKeyHeaders;
  readonly assertionRef: LollipopAssertionRef;
}

export const createReserveLollipopPubKeyUseCase =
  (
    lollipopPort: LollipopOutboundPort,
  ): UseCase<
    ReserveLollipopPubKeyInput,
    ReserveLollipopPubKeyOutput,
    ValidationError | GenericError | ConflictError
  > =>
  async ({ headers }) => {
    const result = LollipopPublicKeyHeadersSchema.safeParse(headers);

    if (!result.success) {
      return err(new ValidationError("Invalid lollipop public key headers."));
    }

    const {
      "x-pagopa-lollipop-pub-key": pubKey,
      "x-pagopa-lollipop-pub-key-hash-algo":
        algo = LollipopPublicKeyHashingAlgorithmSchema.parse("sha256"),
    } = result.data;

    const reserveResult = await lollipopPort.reservePubKey({ algo, pubKey });

    if (reserveResult.isErr()) {
      return err(reserveResult.error);
    }

    return ok({
      assertionRef: reserveResult.value,
      pubKeyHeaders: result.data,
    });
  };
