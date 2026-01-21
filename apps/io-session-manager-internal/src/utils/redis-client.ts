import * as redis from "redis";
import * as TE from "fp-ts/TaskEither";
import { pipe } from "fp-ts/lib/function";
import appInsights from "applicationinsights";
import commands from "@redis/client/dist/lib/cluster/commands";
import { RedisClientConfig } from "../utils/config";

function wrapAsyncFunctionWithAppInsights<
  K extends keyof redis.RedisClusterType,
  T extends redis.RedisClusterType[K],
>(
  redisClient: redis.RedisClusterType,
  originalFunction: T,
  functionName: string,
  clientName: string,
  appInsightsClient: appInsights.TelemetryClient,
): T {
  return async function (...args: unknown[]) {
    const startTime = Date.now();

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (originalFunction as any).apply(redisClient, args);
      const duration = Date.now() - startTime;

      // Do not log any argument or result,
      // as they can contain personal information
      appInsightsClient.trackDependency({
        target: `Redis Cluster - ${clientName}`,
        name: functionName,
        data: "",
        resultCode: "",
        duration,
        success: true,
        dependencyTypeName: "REDIS",
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      appInsightsClient.trackDependency({
        target: `Redis Cluster - ${clientName}`,
        name: functionName,
        data: "",
        resultCode: "ERROR",
        duration,
        success: false,
        dependencyTypeName: "REDIS",
      });
      throw error;
    }
  } as T;
}

function wrapRedisClusterClient(
  client: redis.RedisClusterType,
  clientName: string,
  appInsightsClient: appInsights.TelemetryClient,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clientAsObject = client as Record<any, any>;
  for (const functionName of Object.keys(commands)) {
    if (typeof clientAsObject[functionName] === "function") {
    
      clientAsObject[functionName] = wrapAsyncFunctionWithAppInsights(
        client,
        clientAsObject[functionName],
        functionName,
        clientName,
        appInsightsClient,
      );
    }
  }

  return client;
}

function createWrappedRedisClusterClient(
  options: redis.RedisClusterOptions,
  clientName: string,
  enableDependencyTrace: boolean = false,
  appInsightsClient?: appInsights.TelemetryClient,
) {
  const cluster = redis.createCluster(options);
  return enableDependencyTrace && appInsightsClient
    ? wrapRedisClusterClient(cluster, clientName, appInsightsClient)
    : cluster;
}

const createRedisClusterClient = async (
  redisUrl: string,
  password?: string,
  port?: string,
  enableTls: boolean = true,
  useReplicas: boolean = true,
  enableDependencyTrace: boolean = false,
  appInsightsClient?: appInsights.TelemetryClient,
): Promise<redis.RedisClusterType> => {
  const DEFAULT_REDIS_PORT = enableTls ? "6380" : "6379";
  const prefixUrl = enableTls ? "rediss://" : "redis://";
  const completeRedisUrl = `${prefixUrl}${redisUrl}`;

  const redisPort: number = parseInt(port || DEFAULT_REDIS_PORT, 10);

  const redisClient = createWrappedRedisClusterClient(
    {
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
    },
    useReplicas ? "FAST" : "SAFE",
    enableDependencyTrace,
    appInsightsClient,
  );
  await redisClient.connect();
  return redisClient;
};

const CreateRedisClientTask = (
  config: RedisClientConfig,
  isFastClient: boolean,
  enableDependencyTrace: boolean = false,
  appInsightsClient?: appInsights.TelemetryClient,
): TE.TaskEither<Error, redis.RedisClusterType> =>
  pipe(
    TE.tryCatch(
      () =>
        createRedisClusterClient(
          config.REDIS_URL,
          config.REDIS_PASSWORD,
          config.REDIS_PORT,
          config.REDIS_TLS_ENABLED,
          isFastClient,
          enableDependencyTrace,
          appInsightsClient,
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


let SAFE_REDIS_CLIENT: redis.RedisClusterType;

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
  enableDependencyTrace: boolean = false,
  appInsightsClient?: appInsights.TelemetryClient,
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
        TE.orElseW(() =>
          CreateRedisClientTask(
            config,
            isFastClient,
            enableDependencyTrace,
            appInsightsClient,
          ),
        ),
        TE.map((newRedisClient) =>
          isFastClient
            ? (FAST_REDIS_CLIENT = newRedisClient)
            : (SAFE_REDIS_CLIENT = newRedisClient),
        ),
      ),
    ),
  );
