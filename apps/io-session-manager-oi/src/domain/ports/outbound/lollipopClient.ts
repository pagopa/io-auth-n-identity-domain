import { ResultAsync } from "neverthrow";
import {
  JwkPublicKey,
  LollipopHashAlgorithm,
} from "../../entities/lollipop.js";
import { ConflictError, GenericError } from "@pagopa/hexagonal-core";

export interface LollipopClientI {
  readonly reserveLollipopKey: (
    algo: LollipopHashAlgorithm,
    jwkPubKey: JwkPublicKey,
  ) => ResultAsync<undefined, GenericError | ConflictError>;
}
