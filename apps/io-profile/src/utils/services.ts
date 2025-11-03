import { ServiceCategory } from "@pagopa/io-functions-commons/dist/generated/definitions/ServiceCategory";
import { StandardServiceCategoryEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/StandardServiceCategory";
import {
  ServiceModel,
  Service,
} from "@pagopa/io-functions-commons/dist/src/models/service";
import {
  IResponseErrorQuery,
  ResponseErrorQuery,
} from "@pagopa/io-functions-commons/dist/src/utils/response";
import {
  IResponseErrorNotFound,
  ResponseErrorNotFound,
} from "@pagopa/ts-commons/lib/responses";
import { flow, pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import { RedisClientType } from "redis";
import * as E from "fp-ts/lib/Either";
import * as J from "fp-ts/lib/Json";
import { readableReportSimplified } from "@pagopa/ts-commons/lib/reporters";
import { ServiceId } from "../generated/backend/ServiceId";

const FN_DEFAULT_PREFIX = "FNPROFILE-";
const SERVICE_KEY_PREFIX = `${FN_DEFAULT_PREFIX}SERVICE-`;
const DEFAULT_SERVICE_TTL_SECONDS = 60;

/**
 * Return a task containing either an error or the required Service
 */
export const getServiceOrErrorResponse =
  (
    serviceModel: ServiceModel,
    redisClientTask: TE.TaskEither<Error, RedisClientType>,
  ) =>
  (
    serviceId: ServiceId,
  ): TE.TaskEither<IResponseErrorQuery | IResponseErrorNotFound, Service> =>
    pipe(
      redisClientTask,
      TE.chain((redisClient) =>
        retrieveServiceFromRedis(redisClient, serviceId),
      ),
      TE.fold(
        // cache MISS or REDIS not available, continue retrieving from DB
        () =>
          pipe(
            serviceModel.findLastVersionByModelId([serviceId]),
            TE.mapLeft((failure) =>
              ResponseErrorQuery("Error while retrieving the service", failure),
            ),
            TE.chainW(
              TE.fromOption(() =>
                ResponseErrorNotFound(
                  "Service not found",
                  "The service you requested was not found in the system.",
                ),
              ),
            ),
            TE.chainFirstW((service) =>
              pipe(
                redisClientTask,
                TE.chain((redisClient) =>
                  saveServiceToRedis(redisClient, serviceId, service),
                ),
                // discard every error
                TE.orElseW(() => TE.right(service)),
              ),
            ),
          ),
        // cache HIT
        (service) => TE.right(service),
      ),
    );

const retrieveServiceFromRedis = (
  redis: RedisClientType,
  serviceId: ServiceId,
): TE.TaskEither<Error, Service> =>
  pipe(
    TE.tryCatch(
      () => redis.get(`${SERVICE_KEY_PREFIX}${serviceId}`),
      E.toError,
    ),
    TE.chain(TE.fromNullable(Error("Empty value"))),
    TE.chain(
      flow(
        J.parse,
        E.mapLeft(() => Error("Error while parsing JSON")),
        E.chain(
          flow(
            Service.decode,
            E.mapLeft((decodeErrors) =>
              Error(readableReportSimplified(decodeErrors)),
            ),
          ),
        ),
        TE.fromEither,
      ),
    ),
  );

const saveServiceToRedis = (
  redisClient: RedisClientType,
  serviceId: ServiceId,
  service: Service,
): TE.TaskEither<Error, string> =>
  pipe(
    E.tryCatch(() => JSON.stringify(service), E.toError),
    TE.fromEither,
    TE.chain((value) =>
      pipe(
        TE.tryCatch(
          () =>
            redisClient.setEx(
              `${SERVICE_KEY_PREFIX}${serviceId}`,
              DEFAULT_SERVICE_TTL_SECONDS,
              value,
            ),
          E.toError,
        ),
      ),
    ),
  );

/**
 * Returns the Service Category from a Service.
 * If serviceMetadata are not defined the default value STANDARD is returned.
 *
 * @param service
 * @returns ServiceCategory or StandardServiceCategoryEnum.STANDARD
 */
export const getServiceCategoryOrStandard = (
  service: Service,
): ServiceCategory =>
  service.serviceMetadata?.category || StandardServiceCategoryEnum.STANDARD;
