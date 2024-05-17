import { FnAppRepo, LollipopApi, RedisRepo } from "../repositories";

import * as ProfileService from "./profile";
import * as RedisSessionStorageService from "./redis-session-storage";
import * as TokenService from "./token";
import * as LollipopService from "./lollipop";

export {
  ProfileService,
  RedisSessionStorageService,
  TokenService,
  LollipopService,
};

// Exported Services Dependencies

export type RedisSessionStorageServiceDepencency = {
  redisSessionStorageService: typeof RedisSessionStorageService;
} & RedisRepo.RedisRepositoryDeps;

export type ProfileServiceDepencency = {
  profileService: typeof ProfileService;
} & FnAppRepo.FnAppAPIRepositoryDeps;

export type LollipopServiceDepencency = {
  lollipopService: typeof LollipopService;
} & LollipopApi.LollipopApiDeps;
