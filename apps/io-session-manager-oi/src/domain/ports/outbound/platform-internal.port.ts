import { type GenericError } from "@pagopa/hexagonal-core";
import { type Result } from "neverthrow";
import { HashedClientSessionToken } from "../../value-objects/client-session-token.vo.js";

export interface PlatformInternalPort {
  deleteSession(
    hashedSessionToken: HashedClientSessionToken,
  ): Promise<Result<void, GenericError>>;
}
