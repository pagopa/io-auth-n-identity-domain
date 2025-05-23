// Custom error, used to trigger a retry of an AzureFunction, recovering any transient(temporary) error occurred
export class TransientError extends Error {
  constructor(message?: string, error?: Error) {
    super(message, error);
    this.name = "TransientError";
  }
}
