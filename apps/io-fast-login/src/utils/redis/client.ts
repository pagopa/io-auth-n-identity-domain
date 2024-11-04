import * as redis from "redis";
import * as TE from "fp-ts/TaskEither";
import { pipe } from "fp-ts/lib/function";
import { RedisClientConfig } from "../../config";

export const FUNCTION_PREFIX = "FNFASTLOGIN-";

export const createSimpleRedisClient = async (
  redisUrl: string,
  password?: string,
  port?: string,
  enableTls: boolean = true
): Promise<redis.RedisClientType> => {
  const DEFAULT_REDIS_PORT = enableTls ? "6380" : "6379";
  const prefixUrl = enableTls ? "rediss://" : "redis://";
  const completeRedisUrl = `${prefixUrl}${redisUrl}`;

  const redisPort: number = parseInt(port || DEFAULT_REDIS_PORT, 10);

  const redisClient = redis.createClient<
    Record<string, never>,
    Record<string, never>,
    Record<string, never>
  >({
    legacyMode: false,
    password,
    socket: {
      checkServerIdentity: (_hostname, _cert) => undefined,
      keepAlive: 2000,
      reconnectStrategy: retries => Math.min(retries * 100, 3000),
      tls: enableTls
    },
    url: `${completeRedisUrl}:${redisPort}`
  });
  await redisClient.connect();
  return redisClient;
};

export const CreateRedisClientTask: (
  config: RedisClientConfig
) => TE.TaskEither<Error, redis.RedisClientType> = config =>
  pipe(
    TE.tryCatch(
      () =>
        createSimpleRedisClient(
          config.REDIS_URL,
          config.REDIS_PASSWORD,
          config.REDIS_PORT,
          config.REDIS_TLS_ENABLED
        ),
      () => new Error("Error Connecting redis cluster")
    ),
    TE.chain(redisClient => {
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

      redisClient.on("error", err => {
        // eslint-disable-next-line no-console
        console.info(`Redis error: ${err}`);
      });

      redisClient.on("end", () => {
        // eslint-disable-next-line no-console
        console.info("Client disconnected from redis");
      });
      return TE.right(redisClient);
    })
  );

// eslint-disable-next-line functional/no-let
let REDIS_CLIENT: redis.RedisClientType;

/**
 * Create a TaskEither that evaluate REDIS_CLIENT at runtime.
 * When REDIS_CLIENT is defined it's returned as result, otherwhise
 * a new Redis Client will be created and REDIS_CLIENT defined
 * for the future requests.
 *
 * @param config
 * @returns
 */
export const CreateRedisClientSingleton = (
  config: RedisClientConfig
): TE.TaskEither<Error, redis.RedisClientType> =>
  pipe(
    TE.of(void 0),
    TE.chainW(() =>
      pipe(
        REDIS_CLIENT,
        TE.fromPredicate(
          (maybeRedisCliend): maybeRedisCliend is redis.RedisClientType =>
            maybeRedisCliend !== undefined,
          () => void 0 // Redis Client not yet instantiated
        ),
        TE.orElseW(() => CreateRedisClientTask(config)),
        TE.map(newRedisClient => (REDIS_CLIENT = newRedisClient))
      )
    )
  );

export const singleStringReply = (
  command: TE.TaskEither<Error, string | null>
): TE.TaskEither<Error, boolean> =>
  pipe(
    command,
    TE.map(reply => reply === "OK")
  );

export const falsyResponseToErrorAsync = (error: Error) => (
  response: TE.TaskEither<Error, boolean>
): TE.TaskEither<Error, true> =>
  pipe(
    response,
    TE.chain(value => (value ? TE.right(value) : TE.left(error)))
  );
