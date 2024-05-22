import {
  LOLLIPOP_API_KEY,
  LOLLIPOP_API_URL,
  LOLLIPOP_API_BASE_PATH,
} from "../config/lollipop";
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
    LOLLIPOP_API_KEY,
    LOLLIPOP_API_URL,
    LOLLIPOP_API_BASE_PATH,
    httpOrHttpsApiFetch,
  );

  return {
    fnAppAPIClient,
    fnFastLoginAPIClient,
    fnLollipopAPIClient,
  };
};
