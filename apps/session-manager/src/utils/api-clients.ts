import { LollipopConfig } from "../config/index";
import { FnAppRepo, FnFastLoginRepo, FnLollipopRepo } from "../repositories";
import { getRequiredENVVar } from "./environment";
import { httpOrHttpsApiFetch } from "./fetch";

export const initAPIClientsDependencies: () => FnAppRepo.FnAppAPIRepositoryDeps &
  FnFastLoginRepo.FnFastLoginRepositoryDeps &
  FnLollipopRepo.LollipopApiDeps = () => {
  // Create the API client for the Azure Functions App
  const fnAppAPIClient = FnAppRepo.FnAppAPIClient(
    getRequiredENVVar("API_URL"),
    getRequiredENVVar("API_KEY"),
    httpOrHttpsApiFetch,
  );
  const fnFastLoginAPIClient = FnFastLoginRepo.getFnFastLoginAPIClient(
    getRequiredENVVar("FAST_LOGIN_API_KEY"),
    getRequiredENVVar("FAST_LOGIN_API_URL"),
  );
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
