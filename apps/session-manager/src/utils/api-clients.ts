import { FastLoginConfig, LollipopConfig } from "../config/index";
import { FnAppRepo, FnFastLoginRepo, FnLollipopRepo } from "../repositories";
import { getRequiredENVVar } from "./environment";
import { httpOrHttpsApiFetch } from "./fetch";

export const initAPIClientsDependencies: () => FnAppRepo.FnAppAPIRepositoryDeps &
  FnFastLoginRepo.FnFastLoginRepositoryDeps &
  FnLollipopRepo.LollipopApiDeps = () => {
  // Create the API client for `io-functions-app`
  const fnAppAPIClient = FnAppRepo.FnAppAPIClient(
    getRequiredENVVar("API_URL"),
    getRequiredENVVar("API_KEY"),
    httpOrHttpsApiFetch,
  );
  // Create the API client for `io-functions-fast-login`
  const fnFastLoginAPIClient = FnFastLoginRepo.getFnFastLoginAPIClient(
    FastLoginConfig.FAST_LOGIN_API_KEY,
    FastLoginConfig.FAST_LOGIN_API_URL,
    undefined,
    httpOrHttpsApiFetch,
  );
  // Create the API client for `io-functions-lollipop`
  const fnLollipopAPIClient = FnLollipopRepo.getLollipopApiClient(
    LollipopConfig.LOLLIPOP_API_KEY,
    LollipopConfig.LOLLIPOP_API_URL,
    LollipopConfig.LOLLIPOP_API_BASE_PATH,
    httpOrHttpsApiFetch,
  );

  return {
    fnAppAPIClient,
    fnFastLoginAPIClient,
    fnLollipopAPIClient,
  };
};
