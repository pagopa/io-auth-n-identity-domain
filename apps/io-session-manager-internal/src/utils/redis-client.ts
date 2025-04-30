import * as redis from "redis";
import * as TE from "fp-ts/TaskEither";
import { pipe } from "fp-ts/lib/function";
import { RedisClientConfig } from "../utils/config";

const createRedisClusterClient = async (
  redisUrl: string,
  password?: string,
  port?: string,
  enableTls: boolean = true,
  useReplicas: boolean = true,
): Promise<redis.RedisClusterType> => {
  const DEFAULT_REDIS_PORT = enableTls ? "6380" : "6379";
  const prefixUrl = enableTls ? "rediss://" : "redis://";
  const completeRedisUrl = `${prefixUrl}${redisUrl}`;

  const redisPort: number = parseInt(port || DEFAULT_REDIS_PORT, 10);

  const redisClient = redis.createCluster<
    Record<string, never>,
    Record<string, never>,
    Record<string, never>
  >({
    defaults: {
      legacyMode: false,
      password,
      socket: {
        checkServerIdentity: (_hostname, _cert) => undefined,
        keepAlive: 2000,
        reconnectStrategy: (retries) => Math.min(retries * 100, 3000),
        tls: enableTls,
      },
    },
    rootNodes: [
      {
        url: `${completeRedisUrl}:${redisPort}`,
      },
    ],
    useReplicas,
  });
  await redisClient.connect();
  return redisClient;
};

const CreateRedisClientTask: (
  config: RedisClientConfig,
  isFastClient: boolean,
) => TE.TaskEither<Error, redis.RedisClusterType> = (config, isFastClient) =>
  pipe(
    TE.tryCatch(
      () =>
        createRedisClusterClient(
          config.REDIS_URL,
          config.REDIS_PASSWORD,
          config.REDIS_PORT,
          config.REDIS_TLS_ENABLED,
          isFastClient,
        ),
      () => new Error("Error Connecting redis cluster"),
    ),
    TE.chainW((redisClient) => {
      redisClient.on("connect", () => {
        // eslint-disable-next-line no-console
        console.info("Client connected to redis...");
      });

      redisClient.on("ready", () => {
        // eslint-disable-next-line no-console
        console.info("Client connected to redis and ready to use...");
      });

      redisClient.on("reconnecting", () => {
        // eslint-disable-next-line no-console
        console.info("Client reconnecting...");
      });

      redisClient.on("error", (err) => {
        // eslint-disable-next-line no-console
        console.info(`Redis error: ${err}`);
      });

      redisClient.on("end", () => {
        // eslint-disable-next-line no-console
        console.info("Client disconnected from redis");
      });
      return TE.right(redisClient);
    }),
  );

// eslint-disable-next-line functional/no-let
let SAFE_REDIS_CLIENT: redis.RedisClusterType;
// eslint-disable-next-line functional/no-let
let FAST_REDIS_CLIENT: redis.RedisClusterType;

/**
 * Create a TaskEither that evaluate a redis client at runtime.
 * When the client is defined it's returned as result, otherwhise
 * a new Redis Client will be created and defined
 * for the future requests.
 *
 * @param config
 * @returns
 */
export const CreateRedisClientSingleton = (
  config: RedisClientConfig,
  isFastClient: boolean,
): TE.TaskEither<Error, redis.RedisClusterType> =>
  pipe(
    TE.of(void 0),
    TE.chainW(() =>
      pipe(
        isFastClient ? FAST_REDIS_CLIENT : SAFE_REDIS_CLIENT,
        TE.fromPredicate(
          (maybeRedisClient): maybeRedisClient is redis.RedisClusterType =>
            maybeRedisClient !== undefined,
          () => void 0, // Redis Client not yet instantiated
        ),
        TE.orElseW(() => CreateRedisClientTask(config, isFastClient)),
        TE.map((newRedisClient) =>
          isFastClient
            ? (FAST_REDIS_CLIENT = newRedisClient)
            : (SAFE_REDIS_CLIENT = newRedisClient),
        ),
      ),
    ),
  );
