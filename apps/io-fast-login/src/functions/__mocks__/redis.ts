import * as redis from "redis";
import * as TE from "fp-ts/TaskEither";

export const mockSetEx = jest.fn().mockResolvedValue("OK");
export const mockPing = jest.fn().mockResolvedValue("PONG");
export const mockDel = jest.fn().mockResolvedValue(1);
export const mockRedisClientTask = TE.of(({
  setEx: mockSetEx,
  ping: mockPing,
  del: mockDel
} as unknown) as redis.RedisClientType);
