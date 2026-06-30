import type {
  ConflictError,
  GenericError,
} from "@pagopa/hexagonal-core/domain/errors";
import type {
  LollipopJwk,
  LollipopJwkHashingAlgorithm,
} from "@pagopa/io-auth-n-identity-domain";
import type { Result } from "neverthrow";

import type { LollipopPublicKey } from "../../entities/lollipop-public-key.entity.js";

import { HealthCheckOutboundPort } from "./health-check.outbound-port.js";

export interface LollipopOutboundPort extends HealthCheckOutboundPort {
  reservePubKey(input: {
    algorithm: LollipopJwkHashingAlgorithm;
    publicKey: LollipopJwk;
  }): Promise<Result<LollipopPublicKey, GenericError | ConflictError>>;
}
