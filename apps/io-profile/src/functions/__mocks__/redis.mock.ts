import { vi } from "vitest";
import * as redis from "redis";
import * as TE from "fp-ts/TaskEither";

export const mockSetEx = vi.fn().mockResolvedValue("OK");
export const mockPing = vi.fn().mockResolvedValue("PONG");
// customize this inside your test
export const mockGet = vi.fn().mockResolvedValue(null);
export const mockDel = vi.fn().mockResolvedValue(1);
export const mockRedisClientTask = TE.of({
  setEx: mockSetEx,
  get: mockGet,
  ping: mockPing,
  del: mockDel,
} as unknown as redis.RedisClientType);
