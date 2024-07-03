// redisClusterWrapper.js
import * as redis from "redis";
import appInsights from "applicationinsights";
// import { log } from "./logger";

// Funzione di logging per il wrapping con Application Insights
function wrapAsyncFunctionWithAppInsights<
  K extends keyof redis.RedisClusterType,
  T extends redis.RedisClusterType[K],
>(
  redisClient: redis.RedisClusterType,
  originalFunction: T,
  functionName: K,
  appInsightsClient?: appInsights.TelemetryClient,
): T {
  return async function (...args: any[]) {
    const startTime = Date.now();

    // log.info(`Calling wrapped function ${functionName}...`);

    try {
      const result = await (originalFunction as any).apply(redisClient, args);
      const duration = Date.now() - startTime;

      // log.info(
      //   `End calls wrapped function ${functionName}... Result: ${JSON.stringify(
      //     result,
      //   )}`,
      // );

      appInsightsClient?.trackDependency({
        target: "Redis Cluster",
        name: functionName,
        data: JSON.stringify(args),
        resultCode: JSON.stringify(result),
        duration,
        success: true,
        dependencyTypeName: "REDIS",
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      appInsightsClient?.trackDependency({
        target: "Redis Cluster",
        name: functionName,
        data: JSON.stringify(error),
        resultCode: "ERROR",
        duration,
        success: false,
        dependencyTypeName: "REDIS",
      });
      throw error;
    }
  } as any as T;
}

// Wrappare le funzioni del client Redis Cluster
function wrapRedisClusterClient(
  client: redis.RedisClusterType,
  appInsightsClient?: appInsights.TelemetryClient,
) {
  // log.info("Wrapping Redis Client");

  const asyncFunctions: (keyof typeof client)[] = [
    "get",
    "set",
    "del",
    "setEx",
    "sMembers",
    "sRem",
    "ttl",
    "exists",
  ]; // Lista dei metodi che vuoi wrappare

  asyncFunctions.forEach((functionName) => {
    if (typeof client[functionName] === "function") {
      // log.info(`Wrapping Redis Client --> ${String(functionName)}`);

      const p = client[functionName];

      // eslint-disable-next-line functional/immutable-data
      client[functionName] = wrapAsyncFunctionWithAppInsights(
        client,
        client[functionName],
        functionName,
        appInsightsClient,
      ) as any;
    }
  });

  return client;
}

// Crea e wrappa il client Redis Cluster
export function createWrappedRedisClusterClient(
  options: redis.RedisClusterOptions,
  appInsightsClient?: appInsights.TelemetryClient,
) {
  const cluster = redis.createCluster(options);
  return wrapRedisClusterClient(cluster, appInsightsClient);
}
