import { readableReportSimplified } from "@pagopa/ts-commons/lib/reporters";
import * as t from "io-ts";

export enum ModelErrorTypes {
  GENERIC_ERROR = "GENERIC_ERROR",
  NOT_FOUND = "NOT_FOUND",
  DECODE_ERROR = "DECODE_ERROR",
  CONFLICT = "CONFLICT",
}

export interface BaseError {
  readonly causedBy: Error | undefined;
}

export type NotFoundError = BaseError & {
  readonly kind: ModelErrorTypes.NOT_FOUND;
  readonly entityType: string;
};

export type GenericError = BaseError & {
  readonly kind: ModelErrorTypes.GENERIC_ERROR;
};

export type ConflictError = BaseError & {
  readonly kind: ModelErrorTypes.CONFLICT;
};

export type DecodeError = BaseError & {
  readonly kind: ModelErrorTypes.DECODE_ERROR;
};

export type ModelError =
  | NotFoundError
  | GenericError
  | ConflictError
  | DecodeError;

// -----------------
// Mappers
// -----------------

export const toDecodeError = (errors: t.Errors): DecodeError => ({
  causedBy: new Error(readableReportSimplified(errors)),
  kind: ModelErrorTypes.DECODE_ERROR,
});

export const toConflictError = (msg?: string): ConflictError => ({
  causedBy: msg ? new Error(msg) : undefined,
  kind: ModelErrorTypes.CONFLICT,
});

export const toNotFoundError = (
  entityType: string,
  msg?: string,
): NotFoundError => ({
  entityType,
  causedBy: msg ? new Error(msg) : undefined,
  kind: ModelErrorTypes.NOT_FOUND,
});

export const toGenericError = (msg?: string): GenericError => ({
  causedBy: msg ? new Error(msg) : undefined,
  kind: ModelErrorTypes.GENERIC_ERROR,
});

// -----------------
// Type Checkers
// ----------------

export const isGenericError = (error: ModelError): error is GenericError =>
  error.kind === ModelErrorTypes.GENERIC_ERROR;

export const isDecodeError = (error: ModelError): error is DecodeError =>
  error.kind === ModelErrorTypes.DECODE_ERROR;

export const isNotFoundError = (error: ModelError): error is NotFoundError =>
  error.kind === ModelErrorTypes.NOT_FOUND;

export const isConflictError = (error: ModelError): error is ConflictError =>
  error.kind === ModelErrorTypes.CONFLICT;
