import { type PackageInfo } from "@pagopa/io-package-info";
import fastify, { type FastifyInstance } from "fastify";

import { mountHealthCheckHandler } from "./adapters/inbound/fastify/health-check.handler.js";
import { getHealthCheckUseCase } from "./application/use-cases/health-check.use-case.js";
import { type Config } from "./domain/entities/config.entity.js";
// import { makeFetchLollipopClientAdapter } from "./adapters/outbound/lollipopFetchClient.js";
import * as redis from "redis";
import { makeRedisAusiliarDataAdapter } from "./adapters/outbound/ausiliarDataRedis.js";
import { makeReserveUseCase } from "./application/use-cases/reserve.use-case.js";
import { mountReserveHandler } from "./adapters/inbound/fastify/reserve.handler.js";
import { makeKyLollipopClientAdapter } from "./adapters/outbound/lollipopKyClient.js";
import ky from "ky";

export const createApp = async (
  config: Config,
  packageInfo: PackageInfo,
): Promise<{
  server: FastifyInstance;
}> => {
  const server = fastify({
    trustProxy: true, // Enable trust proxy to get correct client IPs behind proxies (necessary for check-ip hook)
  });

  mountHealthCheckHandler(server, getHealthCheckUseCase(packageInfo, []));
  const kyInstance = ky.create({
    timeout: 5000,
    retry: {
      limit: 2,
      // only retry for rate-limit, internal and network errors
      statusCodes: [408, 429, 500, 502, 503, 504],
      maxRetryAfter: 3000,
    },
  });
  const fetchLollipopAdapter = makeKyLollipopClientAdapter(
    kyInstance,
    config.LOLLIPOP_API_URL,
    config.LOLLIPOP_API_BASE_PATH,
    config.LOLLIPOP_API_KEY,
  );

  const redisClient = await redis
    .createClient({
      url: config.REDIS_URL,
      legacyMode: false,
      password: config.REDIS_PASSWORD,
      socket: {
        tls: false,
      },
    })
    .connect();

  const ausiliarStorageAdapter = makeRedisAusiliarDataAdapter(
    redisClient as redis.RedisClientType,
  );

  const reserveUseCase = makeReserveUseCase({
    ausiliarDataRepository: ausiliarStorageAdapter,
    lollipopClientRepository: fetchLollipopAdapter,
  });

  // --- HTTP function registrations ---

  mountReserveHandler(server, reserveUseCase, config);
  return { server };
};
