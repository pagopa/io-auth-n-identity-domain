import { vi } from "vitest";
import * as redis from "redis";
import * as TE from "fp-ts/TaskEither";

export const mockSetEx = vi.fn().mockResolvedValue("OK");
export const mockPing = vi.fn().mockResolvedValue("PONG");
export const mockDel = vi.fn().mockResolvedValue(1);
export const mockRedisClientTask = TE.of(({
  setEx: mockSetEx,
  ping: mockPing,
  del: mockDel
} as unknown) as redis.RedisClientType);
