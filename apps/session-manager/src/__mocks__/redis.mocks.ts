import * as redis from "redis";
import { vi } from "vitest";
import { RedisClientSelectorType } from "../repositories/redis";

export const mockGet = vi.fn();
export const mockSet = vi.fn();
export const mockSetEx = vi.fn();
export const mockMget = vi.fn();
export const mockSmembers = vi.fn();
export const mockSismember = vi.fn();
export const mockSrem = vi.fn();
export const mockTtl = vi.fn();
export const mockExists = vi.fn();
export const mockDel = vi.fn();
export const mockSadd = vi.fn();
export const mockQuit = vi.fn().mockResolvedValue(void 0);
export const mockRedisClusterType = {
  set: mockSet,
  setEx: mockSetEx,
  get: mockGet,
  mGet: mockMget,
  del: mockDel,
  sAdd: mockSadd,
  sRem: mockSrem,
  sMembers: mockSmembers,
  sIsMember: mockSismember,
  ttl: mockTtl,
  exists: mockExists,
  quit: mockQuit,
} as unknown as redis.RedisClusterType;
export const mockSelect = vi
  .fn()
  .mockImplementation(() => [mockRedisClusterType, mockRedisClusterType]);
export const mockSelectOne = vi
  .fn()
  .mockImplementation(() => mockRedisClusterType);
export const mockRedisClientSelector = {
  select: mockSelect,
  selectOne: mockSelectOne,
} as unknown as RedisClientSelectorType;
