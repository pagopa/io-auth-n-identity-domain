import { GenericError } from "@pagopa/hexagonal-core";
import { ResultAsync } from "neverthrow";
import { LoginAusiliarData } from "../../value-objects/login.vo.js";

export interface AusiliarDataPort {
  readonly save: (
    key: string,
    obj: LoginAusiliarData,
  ) => ResultAsync<undefined, GenericError>;

  readonly retrieve: (
    key: string,
  ) => ResultAsync<LoginAusiliarData | undefined, GenericError>;
}
