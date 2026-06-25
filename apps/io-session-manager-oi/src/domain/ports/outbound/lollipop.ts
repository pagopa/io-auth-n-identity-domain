import type { Result } from "neverthrow";
import type {
  ConflictError,
  GenericError,
} from "@pagopa/io-core-domain/errors";
import type {
  LollipopNewPublicKey,
  LollipopPublicKeyHeaders,
} from "@pagopa/io-auth-n-identity-domain";

export interface LollipopOutboundPort {
  reservePubKey(
    input: LollipopPublicKeyHeaders,
  ): Promise<Result<LollipopNewPublicKey, GenericError | ConflictError>>;
}
