import type { Result } from "neverthrow";
import type {
  ConflictError,
  GenericError,
} from "@pagopa/io-core-domain/errors";
import type {
  LollipopNewPublicKey,
  LollipopPublicKey,
  LollipopPublicKeyHashingAlgorithm,
} from "@pagopa/io-auth-n-identity-domain";

export interface LollipopOutboundPort {
  reservePubKey(input: {
    algorithm: LollipopPublicKeyHashingAlgorithm;
    publicKey: LollipopPublicKey;
  }): Promise<Result<LollipopNewPublicKey, GenericError | ConflictError>>;
}
