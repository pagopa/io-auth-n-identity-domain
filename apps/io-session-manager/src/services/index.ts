import {
  FnAppRepo,
  FnLollipopRepo,
  RedisRepo,
  PlatformInternalRepo,
} from "../repositories";

import * as ProfileService from "./profile";
import * as RedisSessionStorageService from "./redis-session-storage";
import * as TokenService from "./token";
import * as LollipopService from "./lollipop";
import * as LoginService from "./login";
import * as AuthenticationLockService from "./authentication-lock";
import * as PlatformInternalProxyService from "./platform-internal-proxy";

export {
  AuthenticationLockService,
  ProfileService,
  RedisSessionStorageService,
  TokenService,
  LollipopService,
  LoginService,
  PlatformInternalProxyService,
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

export type PlatformInternalProxyServiceDependency = {
  platformInternalApiService: typeof PlatformInternalProxyService;
} & PlatformInternalRepo.PlatformInternalApiDeps;
