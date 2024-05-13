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

export type ExpressMiddleware = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) => void;

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
