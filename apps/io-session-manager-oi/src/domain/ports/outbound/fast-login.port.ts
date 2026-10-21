import {
  AuthenticationError,
  NonEmptyString,
  GenericError,
} from "@pagopa/hexagonal-core";
import { type Result } from "neverthrow";

import { FastLoginParams } from "../../value-objects/fast-login.vo.js";

export interface FastLoginPort {
  generateNonce(): Promise<Result<NonEmptyString, GenericError>>;

  fastLogin(
    payload: FastLoginParams,
  ): Promise<Result<NonEmptyString, AuthenticationError | GenericError>>;
}
