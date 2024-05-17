import {
  IResponse,
  ResponseErrorInternal,
} from "@pagopa/ts-commons/lib/responses";
import * as express from "express";
import * as TE from "fp-ts/TaskEither";
import * as T from "fp-ts/Task";
import { flow, pipe } from "fp-ts/lib/function";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as O from "fp-ts/Option";
import * as E from "fp-ts/Either";
import * as R from "fp-ts/Record";
import { getSpidStrategyOption } from "@pagopa/io-spid-commons/dist/utils/middleware";
import { RedisClientMode, RedisClientSelectorType } from "../types/redis";
import { IDP_METADATA_REFRESH_INTERVAL_SECONDS } from "../config/spid";
import { log } from "./logger";

export type ExpressMiddleware = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) => void;

export type ResLocals = Record<string, unknown> & {
  readonly detail?: string;
  readonly body?: Buffer;
};

export type WithExpressRequest = {
  req: express.Request;
};

export const toExpressHandler =
  <D, R extends IResponse<T>, T>(deps: D) =>
  (handler: RTE.ReaderTaskEither<D & WithExpressRequest, Error, R>) =>
  (req: express.Request, res: express.Response): Promise<void> =>
    pipe(
      handler({
        req,
        locals: res.locals,
        ...deps,
      }),
      TE.mapLeft((err) => ResponseErrorInternal(String(err))),
      TE.toUnion,
      T.map((response) => response.apply(res)),
    )();

/**
 * Convenience method that transforms a function (handler),
 * which takes an express.Request as input and returns an IResponse,
 * into an express middleware. If handler returns undefined
 * the next middleware is called
 * @deprecated
 */
export function toExpressMiddleware<T, P>(
  handler: (req: express.Request) => Promise<IResponse<T> | undefined>,
  object?: P,
): ExpressMiddleware {
  return (req, res, next): Promise<void> =>
    pipe(
      TE.tryCatch(
        () => handler.call(object, req),
        flow(E.toError, (e) => ResponseErrorInternal(e.message)),
      ),
      TE.chainW(
        flow(
          O.fromNullable,
          O.map(TE.left),
          O.getOrElseW(() => TE.right(next())),
        ),
      ),
      TE.mapLeft((response) => {
        // eslint-disable-next-line functional/immutable-data
        res.locals.detail = response.detail;
        response.apply(res);
      }),
      TE.toUnion,
    )();
}

/**
 * Error Handler method for Express Application.
 * Catch an express error and returns a ResponseErrorInternal response
 *
 * @ref https://expressjs.com/en/guide/error-handling.htmls
 */
export const expressErrorMiddleware: (
  err: Error,
  _: express.Request,
  res: express.Response,
  __: express.NextFunction,
) => void = (err, _, res, __) => {
  log.error("An exception occurred during http request: %s", err.message);
  // Send a ResponseErrorInternal only if a response was not already sent to the client
  if (!res.headersSent) {
    ResponseErrorInternal(err.message).apply(res);
  }
};

export const applyErrorMiddleware: (app: express.Express) => T.Task<void> = (
  app,
) => {
  app.use(expressErrorMiddleware);
  return T.of(void 0);
};

export const checkIdpConfiguration: (
  app: express.Express,
) => TE.TaskEither<Error, void> = (app) => {
  const spidStrategyOption = getSpidStrategyOption(app);
  const IdPConfigLoadError = new Error(
    "Fatal error during application start. Cannot get IDPs metadata.",
  );
  // Process ends in case no IDP is configured
  if (R.isEmpty(spidStrategyOption?.idp || {})) {
    log.error(IdPConfigLoadError.message);
    return TE.left(IdPConfigLoadError);
  }
  return TE.of(void 0);
};

/**
 * Setup the time intervar refresh operation for IDP metadata
 * and configure the graceful shutdown function for the express App.
 */
export const setupMetadataRefresherAndGS: (
  redisClientSelector: RedisClientSelectorType,
) => (data: {
  app: express.Express;
  spidConfigTime: bigint;
  idpMetadataRefresher: () => T.Task<void>;
}) => TE.TaskEither<Error, express.Express> =
  (REDIS_CLIENT_SELECTOR) => (data) => {
    // TODO: Add AppInsights startup track event
    log.info(`Spid init time: %sms`, data.spidConfigTime.toString());
    // Schedule automatic idpMetadataRefresher
    const startIdpMetadataRefreshTimer = setInterval(
      () =>
        data
          .idpMetadataRefresher()()
          .catch((e: unknown) => {
            log.error("loadSpidStrategyOptions|error:%s", e);
          }),
      IDP_METADATA_REFRESH_INTERVAL_SECONDS * 1000,
    );
    data.app.on("server:stop", () => {
      clearInterval(startIdpMetadataRefreshTimer);
      // Graceful redis connection shutdown.
      for (const client of REDIS_CLIENT_SELECTOR.select(RedisClientMode.ALL)) {
        log.info(`Graceful closing redis connection`);
        pipe(
          O.fromNullable(client.quit),
          O.map((redisQuitFn) =>
            redisQuitFn().catch((err) =>
              log.error(
                `An Error occurred closing the redis connection: [${
                  E.toError(err).message
                }]`,
              ),
            ),
          ),
        );
      }
    });
    return TE.of(data.app);
  };
