import { vi, describe, it, beforeEach, expect } from "vitest";
import * as t from "io-ts";
import * as E from "fp-ts/lib/Either";
import { OperationInput } from "@azure/cosmos";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import {
  performInsert,
  performPointRead,
  performTransaction,
} from "../cosmosdb";
import {
  containerBatchMock,
  containerItemMock,
  containerItemReadMock,
  containerItemsCreateMock,
  containerMock,
  dummyResource,
} from "../../__mocks__/cosmos.mock";
import { toConflictError, toGenericError, toNotFoundError } from "../errors";

beforeEach(() => {
  vi.clearAllMocks();
});

const dummyCodec = t.type({
  id: t.literal("foo"),
  partitionKey: t.literal("bar"),
});

describe("CosmosDB utilities -> performPointRead", () => {
  it("should succeed on correct parameters", async () => {
    const result = await performPointRead({ container: containerMock })({
      ...dummyResource,
      codec: dummyCodec,
    })();
    expect(result).toEqual(E.right(dummyResource));
    expect(containerItemMock).toHaveBeenCalledOnce();
    expect(containerItemMock).toHaveBeenCalledWith(
      dummyResource.id,
      dummyResource.partitionKey,
    );
    expect(containerItemReadMock).toHaveBeenCalledOnce();
  });

  it("should fail on unreachable cosmos", async () => {
    const anError = Error("unreachable");
    containerItemReadMock.mockRejectedValueOnce(anError);
    const result = await performPointRead({ container: containerMock })({
      ...dummyResource,
      codec: dummyCodec,
    })();
    expect(result).toEqual(
      E.left(toGenericError(`Failed to reach Cosmosdb: ${anError.message}`)),
    );
    expect(containerItemMock).toHaveBeenCalledOnce();
    expect(containerItemReadMock).toHaveBeenCalledOnce();
  });

  it("should return NotFoundError on empty response", async () => {
    containerItemReadMock.mockResolvedValueOnce({
      statusCode: 404,
    });
    const result = await performPointRead({ container: containerMock })({
      ...dummyResource,
      codec: dummyCodec,
    })();
    expect(result).toEqual(E.left(toNotFoundError("item not found")));
    expect(containerItemMock).toHaveBeenCalledOnce();
    expect(containerItemReadMock).toHaveBeenCalledOnce();
  });

  it("should return DecodeError on corrupted response", async () => {
    containerItemReadMock.mockResolvedValueOnce({
      statusCode: 200,
      resource: { item: "corrupted" },
    });
    const result = await performPointRead({ container: containerMock })({
      ...dummyResource,
      codec: dummyCodec,
    })();
    expect(result).toMatchObject({
      left: {
        causedBy: expect.any(Error),
        kind: "DECODE_ERROR",
      },
    });
    expect(containerItemMock).toHaveBeenCalledOnce();
    expect(containerItemReadMock).toHaveBeenCalledOnce();
  });
});

describe("CosmosDB utilities -> performInsert", () => {
  it("should succeed", async () => {
    const result = await performInsert({ container: containerMock })({
      document: dummyResource,
    })();
    expect(result).toEqual(E.right(void 0));
    expect(containerItemsCreateMock).toHaveBeenCalledOnce();
    expect(containerItemsCreateMock).toHaveBeenCalledWith(dummyResource, {
      disableAutomaticIdGeneration: true,
    });
  });

  it("should fail on unreachable cosmosdb", async () => {
    const anError = Error("unreachable");
    containerItemsCreateMock.mockRejectedValueOnce(anError);
    const result = await performInsert({ container: containerMock })({
      document: dummyResource,
    })();
    expect(result).toEqual(
      E.left(toGenericError(`Failed to reach Cosmosdb: ${anError.message}`)),
    );
    expect(containerItemsCreateMock).toHaveBeenCalledOnce();
  });

  it("should return ConflictError on conflict scenario", async () => {
    containerItemsCreateMock.mockResolvedValueOnce({
      statusCode: 409,
    });
    const result = await performInsert({ container: containerMock })({
      document: dummyResource,
    })();
    expect(result).toEqual(E.left(toConflictError()));
    expect(containerItemsCreateMock).toHaveBeenCalledOnce();
  });
});

describe("CosmosDB utilities -> performTransaction", () => {
  it("should succeed", async () => {
    const batch: OperationInput[] = [
      { operationType: "Create", resourceBody: dummyResource },
      {
        operationType: "Create",
        resourceBody: { ...dummyResource, id: "foo2" },
      },
    ];
    const result = await performTransaction({ container: containerMock })({
      batch,
      partitionKey: dummyResource.partitionKey as NonEmptyString,
    })();
    expect(result).toEqual(
      E.right(new Array(2).fill({ statusCode: 200, requestCharge: 999 })),
    );
    expect(containerBatchMock).toHaveBeenCalledOnce();
    expect(containerBatchMock).toHaveBeenCalledWith(
      batch,
      dummyResource.partitionKey,
      {
        disableAutomaticIdGeneration: true,
      },
    );
  });

  it("should fail on unreachable cosmosdb", async () => {
    const anError = new Error("unreachable");
    containerBatchMock.mockRejectedValueOnce(anError);
    const batch: OperationInput[] = [
      { operationType: "Create", resourceBody: dummyResource },
      {
        operationType: "Create",
        resourceBody: { ...dummyResource, id: "foo2" },
      },
    ];
    const result = await performTransaction({ container: containerMock })({
      batch,
      partitionKey: dummyResource.partitionKey as NonEmptyString,
    })();
    expect(result).toEqual(
      E.left(
        toGenericError(`Failed to perform transaction: ${anError.message}`),
      ),
    );
    expect(containerBatchMock).toHaveBeenCalledOnce();
  });

  it("should fail on response with error codes", async () => {
    containerBatchMock.mockResolvedValueOnce({
      headers: {},
      result: [
        {
          statusCode: 200,
          requestCharge: 999,
        },
        { statusCode: 409, requestCharge: 0 },
      ],
    });
    const batch: OperationInput[] = [
      { operationType: "Create", resourceBody: dummyResource },
      {
        operationType: "Create",
        resourceBody: { ...dummyResource, id: "foo2" },
      },
    ];
    const result = await performTransaction({ container: containerMock })({
      batch,
      partitionKey: dummyResource.partitionKey as NonEmptyString,
    })();
    expect(result).toEqual(
      E.left(toGenericError(`Transaction failed with codes: 200,409`)),
    );
    expect(containerBatchMock).toHaveBeenCalledOnce();
  });

  it("should return NotFoundError on empty response", async () => {
    containerBatchMock.mockResolvedValueOnce({
      headers: {},
      result: undefined,
    });
    const batch: OperationInput[] = [
      { operationType: "Create", resourceBody: dummyResource },
      {
        operationType: "Read",
        id: "foo2",
      },
    ];
    const result = await performTransaction({ container: containerMock })({
      batch,
      partitionKey: dummyResource.partitionKey as NonEmptyString,
    })();
    expect(result).toEqual(E.left(toNotFoundError("no results")));
    expect(containerBatchMock).toHaveBeenCalledOnce();
  });
});
