import { describe, expect, it, vi } from "vitest";
import * as E from "fp-ts/lib/Either";
import { HttpError } from "@pagopa/handler-kit";
import { makeInfoHandler } from "../info";
import { httpHandlerInputMocks } from "../__mocks__/handlerMocks";
import { mockRedisClientTask, mockPing } from "../__mocks__/redis";

describe("Info handler", () => {
  it("should return an error if Redis PING command fail", async () => {
    mockPing.mockRejectedValueOnce("db error");
    const result = await makeInfoHandler({
      ...httpHandlerInputMocks,
      redisClientTask: mockRedisClientTask
    })();
    expect(result).toMatchObject(
      E.left(new HttpError("Redis|Error executing the ping to redis"))
    );
  });

  it("should succeed if the application is healthy", async () => {
    const result = await makeInfoHandler({
      ...httpHandlerInputMocks,
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
