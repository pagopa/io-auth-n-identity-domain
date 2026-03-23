import {
  FastLoginConfig,
  FnAppConfig,
  LollipopConfig,
  PlatformProxyConfig,
} from "../config/index";
import {
  FnAppRepo,
  FnFastLoginRepo,
  FnLollipopRepo,
  PlatformInternalClientRepo,
} from "../repositories";
import { httpOrHttpsApiFetch } from "./fetch";

export const initAPIClientsDependencies: () => FnAppRepo.FnAppAPIRepositoryDeps &
  FnFastLoginRepo.FnFastLoginRepositoryDeps &
  FnLollipopRepo.LollipopApiDeps &
  PlatformInternalClientRepo.PlatformInternalClientDeps = () => {
  // Create the API client for `io-profile`
  const fnAppAPIClient = FnAppRepo.FnAppAPIClient(
    FnAppConfig.FN_APP_API_URL,
    FnAppConfig.FN_APP_API_KEY,
    httpOrHttpsApiFetch,
  );
  // Create the API client for `io-functions-fast-login`
  const fnFastLoginAPIClient = FnFastLoginRepo.getFnFastLoginAPIClient(
    FastLoginConfig.FAST_LOGIN_API_KEY,
    FastLoginConfig.FAST_LOGIN_API_URL,
    "",
    httpOrHttpsApiFetch,
  );
  // Create the API client for `io-functions-lollipop`
  const fnLollipopAPIClient = FnLollipopRepo.getLollipopApiClient(
    LollipopConfig.LOLLIPOP_API_KEY,
    LollipopConfig.LOLLIPOP_API_URL,
    LollipopConfig.LOLLIPOP_API_BASE_PATH,
    httpOrHttpsApiFetch,
  );

  // Create the API client for platform proxy
  const platformInternalAPIClient =
    PlatformInternalClientRepo.getPlatformInternalAPIClient(
      PlatformProxyConfig.PLATFORM_PROXY_API_URL,
      httpOrHttpsApiFetch,
    );

  return {
    fnAppAPIClient,
    fnFastLoginAPIClient,
    fnLollipopAPIClient,
    platformInternalAPIClient,
  };
};
