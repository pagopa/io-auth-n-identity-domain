import * as redis from "redis";
import * as appInsights from "applicationinsights";
import { pipe } from "fp-ts/lib/function";
import * as RA from "fp-ts/lib/ReadonlyArray";
import * as O from "fp-ts/lib/Option";
import { log } from "../utils/logger";
import { RedisClientMode, RedisClientSelectorType } from "../types/redis";
import { createWrappedRedisClusterClient } from "../utils/redis-trace-wrapper";

export const sessionKeyPrefix = "SESSION-";
export const walletKeyPrefix = "WALLET-";
export const myPortalTokenPrefix = "MYPORTAL-";
export const bpdTokenPrefix = "BPD-";
export const zendeskTokenPrefix = "ZENDESK-";
export const fimsTokenPrefix = "FIMS-";
export const userSessionsSetKeyPrefix = "USERSESSIONS-";
export const sessionInfoKeyPrefix = "SESSIONINFO-";
export const noticeEmailPrefix = "NOTICEEMAIL-";
export const blockedUserSetKey = "BLOCKEDUSERS";
export const lollipopDataPrefix = "KEYS-";
export const keyPrefixes = [
  sessionKeyPrefix,
  walletKeyPrefix,
  myPortalTokenPrefix,
  fimsTokenPrefix,
  bpdTokenPrefix,
  zendeskTokenPrefix,
  userSessionsSetKeyPrefix,
  sessionInfoKeyPrefix,
  noticeEmailPrefix,
  blockedUserSetKey,
  lollipopDataPrefix,
] as const;
export const sessionNotFoundError = new Error("Session not found");

export const obfuscateTokensInfo = (message: string) =>
  pipe(
    keyPrefixes,
    RA.findFirst((key) => message.includes(key)),
    O.map((key) =>
      // eslint-disable-next-line no-useless-escape
      message.replace(new RegExp(`\\"${key}\\w+\\"`), `"${key}redacted"`),
    ),
    O.getOrElse(() => message),
  );

const createClusterRedisClient =
  (
    enableTls: boolean,
    appInsightsClient?: appInsights.TelemetryClient,
    useReplicas: boolean = true,
  ) =>
  async (
    redisUrl: string,
    password?: string,
    port?: string,
  ): Promise<redis.RedisClusterType> => {
    const DEFAULT_REDIS_PORT = enableTls ? "6380" : "6379";
    const prefixUrl = enableTls ? "rediss://" : "redis://";
    const completeRedisUrl = `${prefixUrl}${redisUrl}`;

    const redisPort: number = parseInt(port || DEFAULT_REDIS_PORT, 10);
    log.info("Creating CLUSTER redis client %s", { url: completeRedisUrl });

    const redisClient = createWrappedRedisClusterClient(
      {
        defaults: {
          legacyMode: false,
          password,
          // 9 minutes PING interval. this solves the `socket closed unexpectedly` event for Azure Cache for Redis
          // (https://github.com/redis/node-redis/issues/1598)
          pingInterval: 1000 * 60 * 9,
          socket: {
            reconnectStrategy: (attempts) => {
              log.info("[REDIS reconnecting] a reconnection events occurs");
              appInsightsClient?.trackEvent({
                name: "io-backend.redis.reconnecting",
                tagOverrides: { samplingEnabled: "false" },
              });
              return Math.min(attempts * 50, 1000);
            },
            // TODO: We can add a whitelist with all the IP addresses of the redis clsuter
            checkServerIdentity: (_hostname, _cert) => undefined,
            keepAlive: 2000,
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
      appInsightsClient,
    );

    redisClient.on("error", (err) => {
      log.error("[REDIS Error] an error occurs on redis client: %s", err);
      appInsightsClient?.trackEvent({
        name: "io-backend.redis.error",
        properties: {
          error: String(err),
          message:
            err instanceof Object
              ? obfuscateTokensInfo(JSON.stringify(err))
              : "",
        },
        tagOverrides: { samplingEnabled: "false" },
      });
    });
    // reconnecting event is not triggered in cluster mode untill the v5 version
    // of the redis client sdk.
    //
    // redisClient.on("reconnecting", () => {
    //   log.info("[REDIS reconnecting] a reconnection events occurs");
    //   appInsightsClient?.trackEvent({
    //     name: "io-backend.redis.reconnecting",
    //     tagOverrides: { samplingEnabled: "false" },
    //   });
    // });
    await redisClient.connect();
    return redisClient;
  };

export const RedisClientSelector =
  (enableTls: boolean, appInsightsClient?: appInsights.TelemetryClient) =>
  async (
    redisUrl: string,
    password?: string,
    port?: string,
  ): Promise<RedisClientSelectorType> => {
    const FAST_REDIS_CLIENT = await createClusterRedisClient(
      enableTls,
      appInsightsClient,
    )(redisUrl, password, port);
    const SAFE_REDIS_CLIENT = await createClusterRedisClient(
      enableTls,
      appInsightsClient,
      false,
    )(redisUrl, password, port);
    const select = (t: RedisClientMode) => {
      switch (t) {
        case RedisClientMode.ALL: {
          return [SAFE_REDIS_CLIENT, FAST_REDIS_CLIENT];
        }
        case RedisClientMode.SAFE: {
          return [SAFE_REDIS_CLIENT];
        }
        case RedisClientMode.FAST: {
          return [FAST_REDIS_CLIENT];
        }
        default: {
          throw new Error("Unexpected selector for redis client");
        }
      }
    };
    return {
      select,
      selectOne: (t) => select(t)[0],
    };
  };

export type RedisRepositoryDeps = {
  redisClientSelector: RedisClientSelectorType;
};
