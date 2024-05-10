export enum DomainErrorTypes {
  GENERIC_ERROR = "GENERIC_ERROR",
  NOT_FOUND = "NOT_FOUND",
  NOT_IMPLEMENTED = "NOT_IMPLEMENTED",
  FORMAT_ERROR = "FORMAT_ERROR",
  UNAUTHORIZED = "UNAUTHORIZED",
}

export interface BaseError {
  readonly causedBy: Error | undefined;
}

export type NotFoundError = BaseError & {
  readonly kind: DomainErrorTypes.NOT_FOUND;
  readonly entityType: string;
};

export type NotImplementedError = BaseError & {
  readonly kind: DomainErrorTypes.NOT_IMPLEMENTED;
};

export type UnauthorizedError = BaseError & {
  readonly kind: DomainErrorTypes.UNAUTHORIZED;
};

export type FormatError = BaseError & {
  readonly kind: DomainErrorTypes.FORMAT_ERROR;
};

export type GenericError = BaseError & {
  readonly kind: DomainErrorTypes.GENERIC_ERROR;
};

/**
 * This type represents an error, any services and function of the core
 * package should use this as Error rappresentation
 */
export type DomainError =
  | NotFoundError
  | NotImplementedError
  | FormatError
  | UnauthorizedError
  | GenericError;

// -----------------
// Mappers
// -----------------

export const unauthorizedError: UnauthorizedError = {
  causedBy: undefined,
  kind: DomainErrorTypes.UNAUTHORIZED,
};

export const formatError: FormatError = {
  causedBy: undefined,
  kind: DomainErrorTypes.FORMAT_ERROR,
};

export const toNotFoundError = (
  entityType: string,
  msg?: string,
): NotFoundError => ({
  entityType,
  causedBy: msg ? new Error(msg) : undefined,
  kind: DomainErrorTypes.NOT_FOUND,
});

export const toGenericError = (msg?: string): GenericError => ({
  causedBy: msg ? new Error(msg) : undefined,
  kind: DomainErrorTypes.GENERIC_ERROR,
});
