import redis from "redis";
import { RedisClientMode } from "../repositories/redis";

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export type Selector<T, S> = {
  readonly select: (type: T) => ReadonlyArray<S>;
  readonly selectOne: (type: T) => S;
};

export type RedisClientSelectorType = Selector<
  RedisClientMode,
  redis.RedisClusterType
>;
