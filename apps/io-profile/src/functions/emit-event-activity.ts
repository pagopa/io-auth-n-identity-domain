import { InvocationContext, output } from "@azure/functions";

export const ActivityName = "EmitEventActivity";

export const getEmitEventActivityHandler =
  (eventsQueueOutput: ReturnType<typeof output.storageQueue>) =>
  async (input: unknown, context: InvocationContext): Promise<void> => {
    const message = typeof input === "string" ? input : JSON.stringify(input);
    context.extraOutputs.set(eventsQueueOutput, message);
  };
