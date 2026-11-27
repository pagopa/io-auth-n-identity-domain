import type { GenericError } from "@pagopa/hexagonal-core";
import type { AuthEvent } from "@pagopa/io-auth-n-identity-session";
import type { ResultAsync } from "neverthrow";

export interface AuthEventPort {
  sendEvent(eventData: AuthEvent): ResultAsync<void, GenericError>;
}
