import {
  AuthenticationError,
  NonEmptyString,
  GenericError,
} from "@pagopa/hexagonal-core";
import { type Result } from "neverthrow";

import { FastLoginPayloadDTO } from "../../../adapters/outbound/dtos/io-fast-login.dto.js";

export interface FastLoginPort {
  fastLogin(
    payload: FastLoginPayloadDTO,
  ): Promise<Result<NonEmptyString, AuthenticationError | GenericError>>;
}
