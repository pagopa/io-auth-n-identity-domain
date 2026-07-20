import {
  AuthenticationError,
  BadGatewayError,
  ConflictError,
  ForbiddenError,
  GatewayTimeoutError,
  GenericError,
  GoneError,
  NotFoundError,
  PreconditionFailedError,
  ServiceUnavailableError,
  TooManyRequestsError,
  UnprocessableEntityError,
  ValidationError,
} from "@pagopa/hexagonal-core";

/**
 * Union of `@pagopa/hexagonal-core` domain errors a Table Storage operation
 * may surface.
 *
 * `RestError`s thrown by the SDK are classified by HTTP `statusCode` into
 * these variants; anything else (including schema validation failures on
 * writes and reads) is folded into the same union so a call site has one
 * error channel to handle.
 */
export type TableStorageError =
  | AuthenticationError
  | BadGatewayError
  | ConflictError
  | ForbiddenError
  | GatewayTimeoutError
  | GenericError
  | GoneError
  | NotFoundError
  | PreconditionFailedError
  | ServiceUnavailableError
  | TooManyRequestsError
  | UnprocessableEntityError
  | ValidationError;
