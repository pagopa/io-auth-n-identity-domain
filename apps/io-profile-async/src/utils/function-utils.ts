import { InvocationContext } from "@azure/functions";

/*
 * Method to check for last retry of a function, based on what found within the InvocationContext
 */
export const isLastTimerTriggerRetry = (context: InvocationContext) =>
  !!context.retryContext &&
  context.retryContext.retryCount === context.retryContext.maxRetryCount;

/*
 * Method to check for last retry of a ServiceBusTriggerfunction, based on what found within the InvocationContext
 */
export const isLastServiceBusTriggerRetry = (
  context: InvocationContext,
  maxDeliveryCount: number,
) =>
  !!context.triggerMetadata?.deliveryCount &&
  context.triggerMetadata.deliveryCount === maxDeliveryCount;
