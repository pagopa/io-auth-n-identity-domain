const hostConfig = require("../host.json");

export const MAX_DEQUEUE_COUNT: number =
  hostConfig.extensions.queues.maxDequeueCount;
