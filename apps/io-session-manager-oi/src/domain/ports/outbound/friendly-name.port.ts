import type { NonEmptyString } from "@pagopa/hexagonal-core";

import type { OidcEnvironment } from "../../value-objects/oidc.vo.js";

export interface IdpFriendlyNamePort {
  getFriendlyName(
    issuer: NonEmptyString,
    env: OidcEnvironment,
  ): Promise<NonEmptyString>;
}
