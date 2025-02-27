export class QueueTransientError extends Error {
  constructor(message?: string, error?: Error) {
    super(message, error);
    this.name = "QueueTransientError";
  }
}

// Custom Error to avoid queueTrigger retry
export class QueuePermanentError extends Error {
  constructor(message?: string, error?: Error) {
    super(message, error);
    this.name = "QueuePermanentError";
  }
}
