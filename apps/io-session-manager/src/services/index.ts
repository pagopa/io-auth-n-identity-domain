import {
  FnAppRepo,
  FnLollipopRepo,
  RedisRepo,
  PlatformInternalClientRepo,
} from "../repositories";

import * as ProfileService from "./profile";
import * as RedisSessionStorageService from "./redis-session-storage";
import * as TokenService from "./token";
import * as LollipopService from "./lollipop";
import * as LoginService from "./login";
import * as AuthenticationLockService from "./authentication-lock";
import * as PlatformInternalService from "./platform-internal";

export {
  AuthenticationLockService,
  ProfileService,
  RedisSessionStorageService,
  TokenService,
  LollipopService,
  LoginService,
  PlatformInternalService,
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

export type PlatformInternalServiceDependency = {
  platformInternalAPIService: typeof PlatformInternalService;
} & PlatformInternalClientRepo.PlatformInternalClientDeps;
