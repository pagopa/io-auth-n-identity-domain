import * as express from "express";
import * as E from "fp-ts/Either";
import * as TE from "fp-ts/TaskEither";
import { flow, pipe } from "fp-ts/lib/function";

import { ContextMiddleware } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/context_middleware";
import { SequenceMiddleware } from "@pagopa/ts-commons/lib/sequence_middleware";
import {
  withRequestMiddlewares,
  wrapRequestHandler
} from "@pagopa/io-functions-commons/dist/src/utils/request_middleware";
import {
  IResponseErrorInternal,
  IResponseErrorNotFound,
  IResponseSuccessJson,
  ResponseErrorForbiddenNotAuthorized,
  ResponseErrorInternal,
  ResponseErrorNotFound,
  ResponseSuccessJson
} from "@pagopa/ts-commons/lib/responses";
import { defaultLog } from "@pagopa/winston-ts";
import { readableReportSimplified } from "@pagopa/ts-commons/lib/reporters";

import { IConfig } from "../utils/config";
import { verifyUserEligibilityMiddleware } from "../utils/middlewares/user-eligibility-middleware";
import {
  ExchangeJwtPayloadExtended,
  exchangeJwtValidationMiddleware
} from "../utils/middlewares/exchange-jwt-validation-middleware";
import {
  HslJwtPayloadExtended,
  hslJwtValidationMiddleware
} from "../utils/middlewares/hsl-jwt-validation-middleware";

import { ProfileData } from "../generated/definitions/external/ProfileData";
import { Client } from "../generated/definitions/io-functions-app/client";

type IProfileErrorResponses = IResponseErrorNotFound | IResponseErrorInternal;

type ProfileHandlerT = (
  user: HslJwtPayloadExtended | ExchangeJwtPayloadExtended
) => Promise<IResponseSuccessJson<ProfileData> | IProfileErrorResponses>;

type ProfileClient = Client<"SubscriptionKey">;

export const profileHandler = (client: ProfileClient): ProfileHandlerT => (
  user_data: HslJwtPayloadExtended | ExchangeJwtPayloadExtended
): ReturnType<ProfileHandlerT> =>
  pipe(
    TE.tryCatch(
      () => client.getProfile({ fiscal_code: user_data.fiscal_number }),
      flow(
        E.toError,
        e =>
          ResponseErrorInternal(
            `Something gone wrong calling fast-login: ${e.message}`
          ),
        defaultLog.peek.error(e => `${e.detail}`)
      )
    ),
    TE.chainW(
      flow(
        TE.fromEither,
        TE.mapLeft(errors =>
          ResponseErrorInternal(readableReportSimplified(errors))
        ),
        defaultLog.taskEither.errorLeft(e => `${e.detail}`),
        TE.chainW(({ status, value }) => {
          switch (status) {
            case 200:
              return TE.right(ResponseSuccessJson({ email: value.email }));
            case 404:
              return TE.left<
                IProfileErrorResponses,
                IResponseSuccessJson<ProfileData>
              >(ResponseErrorNotFound("Not found", "User's profile not found"));
            default:
              return TE.left<
                IProfileErrorResponses,
                IResponseSuccessJson<ProfileData>
              >(
                ResponseErrorInternal(
                  `Something gone wrong. Response Status: {${status}}`
                )
              );
          }
        })
      )
    ),
    TE.toUnion
  )();

export const getProfileHandler = (
  client: ProfileClient,
  config: IConfig
): express.RequestHandler => {
  const handler = profileHandler(client);
  const middlewaresWrap = withRequestMiddlewares(
    ContextMiddleware(),
    verifyUserEligibilityMiddleware(config),
    SequenceMiddleware(ResponseErrorForbiddenNotAuthorized)(
      hslJwtValidationMiddleware(config),
      exchangeJwtValidationMiddleware(config)
    )
  );

  return wrapRequestHandler(middlewaresWrap((_, __, user) => handler(user)));
};
