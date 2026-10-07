import { type GenericError, type UseCase } from "@pagopa/hexagonal-core";

import { type FastLoginPort } from "../../domain/ports/outbound/fast-login.port.js";

export const makeGenerateNonceUseCase =
  (
    fastLoginPort: FastLoginPort,
  ): UseCase<Record<never, never>, { nonce: string }, GenericError> =>
  async () =>
    (await fastLoginPort.generateNonce()).map((nonce) => ({ nonce }));
