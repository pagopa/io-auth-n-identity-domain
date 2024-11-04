import {
  HealthCheck,
  ProblemSource
} from "@pagopa/io-functions-commons/dist/src/utils/healthcheck";

export type HealthCheckBuilder = <T, S extends ProblemSource<S>>(
  dependency: T
) => HealthCheck<S>;
