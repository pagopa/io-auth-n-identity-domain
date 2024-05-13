import { UrlFromString } from "@pagopa/ts-commons/lib/url";
import { ResponseErrorInternal } from "@pagopa/ts-commons/lib/responses";
import { AssertionConsumerServiceT } from "@pagopa/io-spid-commons";
import { RedisRepo } from "../repositories";
import { ClientErrorRedirectionUrlParams } from "../config/spid";
import { FnAppAPIRepositoryDeps } from "../repositories/fn-app-api";

type AcsDependencies = RedisRepo.RedisRepositoryDeps &
  FnAppAPIRepositoryDeps & {
    isLollipopEnabled: boolean;
    getClientErrorRedirectionUrl: (
      params: ClientErrorRedirectionUrlParams,
    ) => UrlFromString;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    appInsightsTelemetryClient?: any;
  };

export const acs: (
  dependencies: AcsDependencies,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
) => AssertionConsumerServiceT<any> =
  (_deps) =>
  (
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    userPayload: unknown,
    // TODO: Add Additional login props
  ) =>
    Promise.resolve(ResponseErrorInternal("Not implemented"));
