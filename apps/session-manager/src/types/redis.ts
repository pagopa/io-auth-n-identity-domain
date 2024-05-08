import redis from "redis";

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export type Selector<T, S> = {
  readonly select: (type: T) => ReadonlyArray<S>;
  readonly selectOne: (type: T) => S;
};

export enum RedisClientMode {
  "ALL" = "ALL",
  "SAFE" = "SAFE",
  "FAST" = "FAST",
}

export type RedisClientSelectorType = Selector<
  RedisClientMode,
  redis.RedisClusterType
>;
