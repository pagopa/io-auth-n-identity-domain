import { GenericError, NotFoundError } from "@pagopa/hexagonal-core";
import { HealthCheckOutboundPort } from "@pagopa/io-auth-n-identity-domain";
import { Result } from "neverthrow";

import { LoginAuxiliaryData } from "../../value-objects/login.vo.js";

export interface AuxiliaryDataPort extends HealthCheckOutboundPort {
  readonly save: (
    id: string,
    obj: LoginAuxiliaryData,
  ) => Promise<Result<undefined, GenericError>>;

  readonly retrieve: (
    id: string,
  ) => Promise<Result<LoginAuxiliaryData, GenericError | NotFoundError>>;
}
