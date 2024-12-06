import * as t from "io-ts";
import * as O from "fp-ts/lib/Option";
import { pipe } from "fp-ts/lib/function";
import { CosmosErrors } from "@pagopa/io-functions-commons/dist/src/utils/cosmosdb_model";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { errorsToReadableMessages } from "@pagopa/ts-commons/lib/reporters";
import {
  IResponseErrorInternal,
  IResponseErrorNotFound,
  ResponseErrorInternal,
  ResponseErrorNotFound
} from "@pagopa/ts-commons/lib/responses";

export const assertNever = (x: never): never => {
  throw new Error(`Unexpected object: ${JSON.stringify(x)}`);
};

export const TransientFailure = t.interface({
  kind: t.literal("TRANSIENT"),
  reason: t.string
});
export type TransientFailure = t.TypeOf<typeof TransientFailure>;

export const PermanentFailure = t.interface({
  kind: t.literal("PERMANENT"),
  reason: t.string
});
export type PermanentFailure = t.TypeOf<typeof PermanentFailure>;

export const Failure = t.intersection([
  t.union([TransientFailure, PermanentFailure]),
  t.partial({ modelId: t.string })
]);
export type Failure = t.TypeOf<typeof Failure>;

export const toTransientFailure = (err: Error, customReason?: string) => (
  modelId?: string
): Failure =>
  pipe(
    customReason,
    O.fromNullable,
    O.map(reason => `ERROR=${reason} DETAIL=${err.message}`),
    O.getOrElse(() => `ERROR=${err.message}`),
    errorMsg =>
      Failure.encode({
        kind: "TRANSIENT",
        modelId,
        reason: `TRANSIENT FAILURE|${errorMsg}`
      })
  );

export const toPermanentFailure = (err: Error, customReason?: string) => (
  modelId?: string
): Failure =>
  pipe(
    customReason,
    O.fromNullable,
    O.map(reason => `ERROR=${reason} DETAIL=${err.message}`),
    O.getOrElse(() => `ERROR=${err.message}`),
    errorMsg =>
      Failure.encode({
        kind: "PERMANENT",
        modelId,
        reason: `PERMANENT FAILURE|${errorMsg}`
      })
  );

//
// LOLLIPOP READERS/WRITERS ERRORS
//
export enum ErrorKind {
  NotFound = "NotFound",
  Internal = "Internal"
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export interface InternalError {
  readonly kind: ErrorKind.Internal;
  readonly detail: string;
  readonly message: string;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export interface NotFoundError {
  readonly kind: ErrorKind.NotFound;
}

export type DomainError = InternalError | NotFoundError;

export const toInternalError = (
  errorMessage: string,
  responseDetail?: string
): InternalError => ({
  detail: responseDetail ?? errorMessage,
  kind: ErrorKind.Internal as const,
  message: errorMessage
});

export const toNotFoundError = (): NotFoundError => ({
  kind: ErrorKind.NotFound as const
});

export const cosmosErrorsToString = (errs: CosmosErrors): NonEmptyString =>
  pipe(
    errs.kind === "COSMOS_EMPTY_RESPONSE"
      ? "Empty response"
      : errs.kind === "COSMOS_DECODING_ERROR"
      ? "Decoding error: " + errorsToReadableMessages(errs.error).join("/")
      : errs.kind === "COSMOS_CONFLICT_RESPONSE"
      ? "Conflict error"
      : "Generic error: " + JSON.stringify(errs.error),

    errorString => errorString as NonEmptyString
  );

export const domainErrorToResponseError = (
  error: DomainError
): IResponseErrorNotFound | IResponseErrorInternal =>
  error.kind === ErrorKind.NotFound
    ? ResponseErrorNotFound(error.kind, "Could not find requested resource")
    : ResponseErrorInternal(error.detail);
