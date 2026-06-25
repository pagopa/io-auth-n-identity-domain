import type {
  LollipopJwk,
  LollipopJwkHashingAlgorithm,
} from "@pagopa/io-auth-n-identity-domain";
import type {
  ConflictError,
  GenericError,
} from "@pagopa/io-core-domain/errors";
import type { Result } from "neverthrow";


import type { LollipopPublicKey } from "../../entities/lollipop-public-key.entity.js";

export interface LollipopOutboundPort {
  reservePubKey(input: {
    algorithm: LollipopJwkHashingAlgorithm;
    publicKey: LollipopJwk;
  }): Promise<Result<LollipopPublicKey, GenericError | ConflictError>>;
}
