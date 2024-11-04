import * as H from "@pagopa/handler-kit";
import { makeGenerateNonce } from "../generate-nonce";
import { httpHandlerInputMocks } from "../__mocks__/handlerMocks";
import { DEFAULT_NONCE_EXPIRE_SEC, NONCE_PREFIX } from "../../model/nonce";
import { FUNCTION_PREFIX } from "../../utils/redis/client";
import * as E from "fp-ts/Either";
import { mockRedisClientTask, mockSetEx } from "../__mocks__/redis";

describe("GenerateNonce handler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return 200 if the nonce is generated on Redis", async () => {
    const mockReq: H.HttpRequest = {
      ...H.request("https://api.test.it/")
    };
    const result = await makeGenerateNonce({
      ...httpHandlerInputMocks,
      input: mockReq,
      redisClientTask: mockRedisClientTask
    })();

    expect(mockSetEx).toHaveBeenCalled();
    expect(mockSetEx).toHaveBeenCalledWith(
      expect.stringContaining(`${FUNCTION_PREFIX}${NONCE_PREFIX}`),
      DEFAULT_NONCE_EXPIRE_SEC,
      ""
    );
    expect(E.isRight(result)).toEqual(true);
    expect(result).toMatchObject({
      right: {
        statusCode: 200,
        body: expect.objectContaining({ nonce: expect.any(String) })
      }
    });
  });

  it("should return 500 internal error if the creation on redis fails", async () => {
    const mockReq: H.HttpRequest = {
      ...H.request("https://api.test.it/")
    };
    mockSetEx.mockRejectedValueOnce(new Error("Error"));
    const result = await makeGenerateNonce({
      ...httpHandlerInputMocks,
      input: mockReq,
      redisClientTask: mockRedisClientTask
    })();

    expect(mockSetEx).toHaveBeenCalled();
    expect(mockSetEx).toHaveBeenCalledWith(
      expect.stringContaining(`${FUNCTION_PREFIX}${NONCE_PREFIX}`),
      DEFAULT_NONCE_EXPIRE_SEC,
      ""
    );
    expect(E.isRight(result)).toEqual(true);
    expect(result).toMatchObject({
      right: {
        statusCode: 500
      }
    });
  });
});
