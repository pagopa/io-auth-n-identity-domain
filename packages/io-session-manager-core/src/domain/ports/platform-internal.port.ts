import { type GenericError } from "@pagopa/hexagonal-core";
import { HashedClientSessionToken } from "@pagopa/io-auth-n-identity-session";
import { type Result } from "neverthrow";

export interface PlatformInternalPort {
  deleteSession(
    hashedClientSessionToken: HashedClientSessionToken,
  ): Promise<Result<void, GenericError>>;
}
