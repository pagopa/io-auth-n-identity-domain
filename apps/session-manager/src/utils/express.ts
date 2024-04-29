import {
  IResponse,
  ResponseErrorInternal,
} from "@pagopa/ts-commons/lib/responses";
import * as express from "express";
import * as TE from "fp-ts/TaskEither";
import * as T from "fp-ts/Task";
import { pipe } from "fp-ts/lib/function";

export type WithExpressRequest = {
  req: express.Request;
};

export const toExpressHandlerRTE =
  <D, T>(deps4: D) =>
  (
    handler: (
      depsWithReq: D & WithExpressRequest,
    ) => TE.TaskEither<Error, IResponse<T>>,
  ) =>
  (req: express.Request, res: express.Response): Promise<void> =>
    pipe(
      handler({
        req,
        ...deps4,
      }),
      TE.mapLeft((err) => ResponseErrorInternal(String(err))),
      TE.toUnion,
      T.map((response) => response.apply(res)),
    )();
