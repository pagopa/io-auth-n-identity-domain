import { makeInfoHandler } from "../info";
import { Database } from "@azure/cosmos";
import { httpHandlerInputMocks } from "../__mocks__/handlerMocks";
import * as E from "fp-ts/lib/Either";
import { mockRedisClientTask, mockPing } from "../__mocks__/redis";

const mockDatabaseAccount = jest.fn().mockResolvedValue("");
const cosmosDatabaseMock = ({
  client: {
    getDatabaseAccount: mockDatabaseAccount
  }
} as unknown) as Database;

describe("Info handler", () => {
  it("should return an error if the Cosmos health check fail", async () => {
    mockDatabaseAccount.mockRejectedValueOnce("db error");
    const result = await makeInfoHandler({
      ...httpHandlerInputMocks,
      db: cosmosDatabaseMock,
      redisClientTask: mockRedisClientTask
    })();
    expect(result).toMatchObject(E.left(new Error("AzureCosmosDB|db error")));
  });

  it("should return an error if Redis PING command fail", async () => {
    mockPing.mockRejectedValueOnce("db error");
    const result = await makeInfoHandler({
      ...httpHandlerInputMocks,
      db: cosmosDatabaseMock,
      redisClientTask: mockRedisClientTask
    })();
    expect(result).toMatchObject(
      E.left(new Error("Redis|Error executing the ping to redis"))
    );
  });

  it("should succeed if the application is healthy", async () => {
    const result = await makeInfoHandler({
      ...httpHandlerInputMocks,
      db: cosmosDatabaseMock,
      redisClientTask: mockRedisClientTask
    })();

    expect(result).toMatchObject(
      E.right({
        statusCode: 200,
        body: { message: "it works!" },
        headers: expect.any(Object)
      })
    );
  });
});
