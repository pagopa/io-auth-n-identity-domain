/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { wrapRequestHandler } from "@pagopa/io-functions-commons/dist/src/utils/request_middleware";
import {
  IResponseErrorInternal,
  ResponseErrorInternal
} from "@pagopa/ts-commons/lib/responses";
import express from "express";

type InfoHandler = () => Promise<IResponseErrorInternal>;

export const FailureHandler = (): InfoHandler => async (): Promise<
  IResponseErrorInternal
> => ResponseErrorInternal("Failure endpoint");

export const Failure = (): express.RequestHandler => {
  const handler = FailureHandler();

  return wrapRequestHandler(handler);
};
