import * as redis from "redis";
import appInsights from "applicationinsights";

import commands from "@redis/client/dist/lib/cluster/commands";
import { RedisClusterType } from "redis";

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

export function createWrappedRedisClusterClient(
  options: redis.RedisClusterOptions,
  clientName: string,
  enableDependencyTrace: boolean = false,
  appInsightsClient?: appInsights.TelemetryClient,
): RedisClusterType {
  const cluster = redis.createCluster(options);
  return enableDependencyTrace && appInsightsClient
    ? wrapRedisClusterClient(cluster, clientName, appInsightsClient)
    : cluster;
}
