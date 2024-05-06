import {
  IResponse,
  ResponseErrorInternal,
} from "@pagopa/ts-commons/lib/responses";
import * as express from "express";
import * as TE from "fp-ts/TaskEither";
import * as T from "fp-ts/Task";
import { pipe } from "fp-ts/lib/function";
import * as RTE from "fp-ts/ReaderTaskEither";

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
