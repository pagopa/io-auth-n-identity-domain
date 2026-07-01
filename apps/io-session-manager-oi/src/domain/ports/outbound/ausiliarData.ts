import { GenericError } from "@pagopa/hexagonal-core";
import { ResultAsync } from "neverthrow";
import { LoginAusiliarData } from "../../entities/login.js";

export interface AusiliarDataI {
  readonly save: (
    key: string,
    obj: LoginAusiliarData,
  ) => ResultAsync<undefined, GenericError>;

  readonly retrieve: (
    key: string,
  ) => ResultAsync<LoginAusiliarData | undefined, GenericError>;
}
