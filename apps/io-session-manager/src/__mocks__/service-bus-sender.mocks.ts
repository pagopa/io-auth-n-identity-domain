import { ServiceBusSender, ServiceBusMessage } from "@azure/service-bus";
import { vi } from "vitest";

const mockSendMessages = vi.fn().mockImplementation(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  (messages: ServiceBusMessage | ServiceBusMessage[]): Promise<void> =>
    Promise.resolve(void 0),
);

export const mockServiceBusSender = {
  sendMessages: mockSendMessages,
} as Partial<ServiceBusSender> as ServiceBusSender;
