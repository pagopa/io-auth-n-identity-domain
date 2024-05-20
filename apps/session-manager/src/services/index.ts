import { FnAppRepo, FnLollipopRepo, RedisRepo } from "../repositories";

import * as ProfileService from "./profile";
import * as RedisSessionStorageService from "./redis-session-storage";
import * as TokenService from "./token";
import * as LollipopService from "./lollipop";
import * as LoginService from "./login";
import * as AuthenticationLockService from "./authentication-lock";

export {
  AuthenticationLockService,
  ProfileService,
  RedisSessionStorageService,
  TokenService,
  LollipopService,
  LoginService,
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
} & FnLollipopRepo.LollipopApiDeps;
