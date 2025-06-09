// Custom error, used to trigger a retry of an AzureFunction, recovering any transient(temporary) error occurred
export class TransientError extends Error {
  constructor(message?: string, error?: Error) {
    super(message, error);
    this.name = "TransientError";
  }
}

// Custom error, used to mark a permanent error occurred during AzureFunction execution, errors that cannot be recovered automatically by a retry
export class PermanentError extends Error {
  constructor(message?: string, error?: Error) {
    super(message, error);
    this.name = "PermanentError";
  }
}