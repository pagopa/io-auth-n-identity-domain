import { Container, OperationResponse, Response } from "@azure/cosmos";
import { vi } from "vitest";

export const dummyResource = {
  id: "foo",
  partitionKey: "bar",
} as const;
export const containerItemReadMock = vi
  .fn()
  .mockResolvedValue({ statusCode: 200, resource: dummyResource });
export const containerItemMock = vi.fn().mockReturnValue({
  read: containerItemReadMock,
});
export const containerItemsCreateMock = vi
  .fn()
  .mockResolvedValue({ statusCode: 201 });
export const containerBatchMock = vi.fn(async (arr: unknown[]) =>
  Promise.resolve({
    headers: {},
    result: new Array(arr.length).fill({
      statusCode: 200,
      resourceBody: undefined,
      requestCharge: 999,
    }),
  } as Response<OperationResponse[]>),
);

export const containerMock = {
  item: containerItemMock,
  items: {
    create: containerItemsCreateMock,
    batch: containerBatchMock,
  },
} as unknown as Container;
