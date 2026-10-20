import { GenericError, NonEmptyString  } from "@pagopa/hexagonal-core";
import { Result } from "neverthrow";
import { OidcEnvironment } from "../../value-objects/oidc.vo.js";



export interface IdpFriendlyNamePort {
  getFriendlyName(issuer: string, env: OidcEnvironment): Promise<Result<NonEmptyString, GenericError>>;
}