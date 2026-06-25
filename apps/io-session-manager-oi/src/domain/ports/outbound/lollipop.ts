import type { Result } from "neverthrow";
import type {
  ConflictError,
  GenericError,
} from "@pagopa/io-core-domain/errors";
import type {
  LollipopAssertionRef,
  LollipopPublicKey,
  LollipopPublicKeyHashingAlgorithm,
} from "@pagopa/io-auth-n-identity-domain";

export interface LollipopOutboundPort {
  reservePubKey(input: {
    algo: LollipopPublicKeyHashingAlgorithm;
    pubKey: LollipopPublicKey;
  }): Promise<Result<LollipopAssertionRef, GenericError | ConflictError>>;
}
