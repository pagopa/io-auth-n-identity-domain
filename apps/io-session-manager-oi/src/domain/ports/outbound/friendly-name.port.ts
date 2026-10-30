import type { NonEmptyString } from "@pagopa/hexagonal-core";

import type { OidcEnvironment } from "../../value-objects/oidc.vo.js";
import { Result } from "neverthrow";

export interface IdpFriendlyNamePort {
  getFriendlyName(
    issuer: NonEmptyString,
    env: OidcEnvironment,
  ): Promise<Result<NonEmptyString, Error>>;
}
