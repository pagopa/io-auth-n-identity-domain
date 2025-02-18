// Custom Error to handle queueTrigger retry
export class QueueTransientError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = "QueueTransientError";
  }
}
