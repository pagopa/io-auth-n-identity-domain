import { GenericError } from "@pagopa/hexagonal-core";
import { AuthEvent } from "@pagopa/io-auth-n-identity-session";
import { ResultAsync } from "neverthrow";

export interface AuthEventPort {
  sendEvent(eventData: AuthEvent): ResultAsync<void, GenericError>;
}
