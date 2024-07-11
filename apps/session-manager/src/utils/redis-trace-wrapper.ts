import * as redis from "redis";
import appInsights from "applicationinsights";

function wrapAsyncFunctionWithAppInsights<
  K extends keyof redis.RedisClusterType,
  T extends redis.RedisClusterType[K],
>(
  redisClient: redis.RedisClusterType,
  originalFunction: T,
  functionName: string,
  appInsightsClient?: appInsights.TelemetryClient,
): T {
  return async function (...args: unknown[]) {
    const startTime = Date.now();

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (originalFunction as any).apply(redisClient, args);
      const duration = Date.now() - startTime;

      // Do not log any argument or result,
      // as they can contain personal information
      appInsightsClient?.trackDependency({
        target: "Redis Cluster",
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
      appInsightsClient?.trackDependency({
        target: "Redis Cluster",
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
  appInsightsClient?: appInsights.TelemetryClient,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clientAsObject = client as Record<any, any>;
  for (const functionName in clientAsObject) {
    if (typeof clientAsObject[functionName] === "function") {
      // eslint-disable-next-line functional/immutable-data
      clientAsObject[functionName] = wrapAsyncFunctionWithAppInsights(
        client,
        clientAsObject[functionName],
        functionName,
        appInsightsClient,
      );
    }
  }

  return client;
}

export function createWrappedRedisClusterClient(
  options: redis.RedisClusterOptions,
  enableDependencyTrace: boolean,
  appInsightsClient?: appInsights.TelemetryClient,
) {
  const cluster = redis.createCluster(options);
  return enableDependencyTrace
    ? wrapRedisClusterClient(cluster, appInsightsClient)
    : cluster;
}
