import { Context } from "@azure/functions";

/*
 * Method to check for last retry of a function, based on what found within the InvocationContext
 */
export const isLastTimerTriggerRetry = (context: Context) =>
  !!context.executionContext.retryContext &&
  context.executionContext.retryContext.retryCount ===
    context.executionContext.retryContext.maxRetryCount;

/*
 * Method to check for last retry of a ServiceBusTriggerfunction, based on what found within the InvocationContext
 */
export const isLastServiceBusTriggerRetry = (
  context: Context,
  maxDeliveryCount: number
) =>
  !!context.bindingData.deliveryCount &&
  context.bindingData.deliveryCount === maxDeliveryCount;
