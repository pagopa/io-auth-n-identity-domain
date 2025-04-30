import { app } from "@azure/functions";
import { InfoService } from "../services/info";
import { Package } from "../repositories/package";
import { CreateRedisClientSingleton } from "../utils/redis-client";
import { getConfigOrThrow } from "../utils/config";
import { SessionService } from "../services/session-service";
import { RedisRepository } from "../repositories/redis";
import { InfoFunction } from "./info";
import { GetSessionFunction } from "./get-session";

const config = getConfigOrThrow();

const fastRedisClientTask = CreateRedisClientSingleton(config, true);
const safeRedisClientTask = CreateRedisClientSingleton(config, false);

app.http("Info", {
  authLevel: "anonymous",
  handler: InfoFunction({ InfoService, Package }),
  methods: ["GET"],
  route: "api/v1/info",
});

app.http("GetSession", {
  authLevel: "function",
  handler: GetSessionFunction({
    FastRedisClientTask: fastRedisClientTask,
    SafeRedisClientTask: safeRedisClientTask,
    SessionService,
    RedisRepository,
  }),
  methods: ["GET"],
  route: "api/v1/sessions/{fiscalCode}",
});
