import {
  AuthenticationError,
  NonEmptyString,
  GenericError,
} from "@pagopa/hexagonal-core";
import { type Result } from "neverthrow";
import { FastLoginParams } from "../../entities/fast-login.entity.js";

export interface FastLoginPort {
  fastLogin(
    payload: FastLoginParams,
  ): Promise<Result<NonEmptyString, AuthenticationError | GenericError>>;
}
