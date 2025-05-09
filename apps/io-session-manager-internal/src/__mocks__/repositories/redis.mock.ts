import * as O from "fp-ts/lib/Option";
import * as TE from "fp-ts/lib/TaskEither";
import { vi } from "vitest";
import * as redisLib from "redis";
import { RedisRepository } from "../../repositories/redis";
import { anAssertionRef } from "../user.mock";

export const mockUserHasActiveSessionsOrLV = vi
  .fn()
  .mockReturnValue(TE.right(true));

export const mockDelLollipopDataForUser = vi
  .fn()
  .mockReturnValue(TE.right(true));
export const mockDelUserAllSessions = vi.fn().mockReturnValue(TE.right(true));
export const mockGetLollipopAssertionRefForUser = vi
  .fn()
  .mockReturnValue(TE.right(O.some(anAssertionRef)));

export const RedisRepositoryMock: RedisRepository = {
  userHasActiveSessionsOrLV: mockUserHasActiveSessionsOrLV,
  delLollipopDataForUser: mockDelLollipopDataForUser,
  delUserAllSessions: mockDelUserAllSessions,
  getLollipopAssertionRefForUser: mockGetLollipopAssertionRefForUser,
};

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
export const mockRedisClient = {
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
} as unknown as redisLib.RedisClusterType;

export const RedisClientTaskMock = TE.right(mockRedisClient);
