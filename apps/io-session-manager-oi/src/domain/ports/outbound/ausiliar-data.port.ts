import { GenericError } from "@pagopa/hexagonal-core";
import { HealthCheckOutboundPort } from "@pagopa/io-auth-n-identity-domain";
import { Result } from "neverthrow";
import { LoginAusiliarData } from "../../value-objects/login.vo.js";

export interface AusiliarDataPort extends HealthCheckOutboundPort {
  readonly save: (
    id: string,
    obj: LoginAusiliarData,
  ) => Promise<Result<undefined, GenericError>>;

  readonly retrieve: (
    id: string,
  ) => Promise<Result<LoginAusiliarData | undefined, GenericError>>;
}
