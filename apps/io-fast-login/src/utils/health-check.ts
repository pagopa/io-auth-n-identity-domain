import {
  HealthCheck,
  ProblemSource
} from "@pagopa/io-functions-commons/dist/src/utils/healthcheck";

export type HealthCheckBuilder = <T, S1, S2 extends ProblemSource<S1>>(
  dependency: T
) => HealthCheck<S2>;
