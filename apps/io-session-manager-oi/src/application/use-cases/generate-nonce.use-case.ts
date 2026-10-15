import { type GenericError, type UseCase, type NonEmptyString } from "@pagopa/hexagonal-core";

import { type FastLoginPort } from "../../domain/ports/outbound/fast-login.port.js";

export const makeGenerateNonceUseCase =
  (
    fastLoginPort: FastLoginPort,
  ): UseCase<Record<never, never>, NonEmptyString, GenericError> =>
  async () =>
    (await fastLoginPort.generateNonce());
