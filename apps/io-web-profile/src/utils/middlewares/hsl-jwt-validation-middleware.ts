import * as E from "fp-ts/Either";
import * as TE from "fp-ts/TaskEither";
import { flow, pipe } from "fp-ts/lib/function";
import * as jwt from "jsonwebtoken";
import { getValidateJWT } from "@pagopa/ts-commons/lib/jwt_with_key_rotation";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import {
  getResponseErrorForbiddenNotAuthorized,
  IResponseErrorForbiddenNotAuthorized,
  IResponseSuccessJson,
  ResponseErrorForbiddenNotAuthorized,
  ResponseSuccessJson,
  ResponseErrorInternal,
  IResponseErrorInternal
} from "@pagopa/ts-commons/lib/responses";

import { readableReportSimplified } from "@pagopa/ts-commons/lib/reporters";
import * as t from "io-ts";
import { enumType } from "@pagopa/ts-commons/lib/types";
import { IRequestMiddleware } from "@pagopa/io-functions-commons/dist/src/utils/request_middleware";
import { IConfig } from "../config";
import { getHubSpidLoginClient } from "../../clients/hubSpidLogin";
import { IntrospectSuccessResponse } from "../../generated/definitions/hub-spid-login/IntrospectSuccessResponse";
import { SpidLevel } from "../enums/SpidLevels";
import { BaseJwtPayload, jwtValidationMiddleware } from "../jwt";

export const HslJwtPayloadExtended = t.intersection([
  BaseJwtPayload,
  t.type({
    spid_level: enumType(SpidLevel, "spidLevel")
  })
]);
export type HslJwtPayloadExtended = t.TypeOf<typeof HslJwtPayloadExtended>;

type IjwtIntrospectionCall = (
  token: NonEmptyString,
  config: IConfig
) => TE.TaskEither<
  IResponseErrorInternal | IResponseErrorForbiddenNotAuthorized,
  IResponseSuccessJson<IntrospectSuccessResponse>
>;
export const introspectionCall: IjwtIntrospectionCall = (token, config) =>
  pipe(
    TE.tryCatch(
      () =>
        getHubSpidLoginClient(
          config.HUB_SPID_LOGIN_CLIENT_BASE_URL
        ).introspectToken({
          body: {
            token
          }
        }),
      flow(E.toError, () =>
        ResponseErrorInternal(
          `Something went wrong while calling the introspection endpoint`
        )
      )
    ),
    TE.chain(
      flow(
        TE.fromEither,
        TE.mapLeft(errors =>
          ResponseErrorInternal(readableReportSimplified(errors))
        ),
        TE.chainW(response => {
          switch (response.status) {
            case 200:
              return response.value.active
                ? TE.right(ResponseSuccessJson(response.value))
                : TE.left<
                    | IResponseErrorForbiddenNotAuthorized
                    | IResponseErrorInternal
                  >(ResponseErrorForbiddenNotAuthorized);
            case 403:
              return TE.left<
                IResponseErrorForbiddenNotAuthorized | IResponseErrorInternal
              >(ResponseErrorForbiddenNotAuthorized);
            default:
              return TE.left(ResponseErrorInternal(`Something went wrong`));
          }
        })
      )
    )
  );

export const hslJwtValidation = (
  config: IConfig
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
) => (
  token: NonEmptyString
): TE.TaskEither<IResponseErrorForbiddenNotAuthorized, jwt.JwtPayload> =>
  pipe(
    getValidateJWT(
      config.HUB_SPID_LOGIN_JWT_ISSUER,
      config.HUB_SPID_LOGIN_JWT_PUB_KEY
    )(token),
    TE.mapLeft(error => getResponseErrorForbiddenNotAuthorized(error.message)),
    TE.chain(jwtDecoded =>
      pipe(
        introspectionCall(token, config),
        TE.fold(
          _ =>
            TE.left(
              getResponseErrorForbiddenNotAuthorized("Token is not valid")
            ),
          // active is always true if we are in this rail
          _ => TE.right(jwtDecoded)
        )
      )
    )
  );

export const hslJwtValidationMiddleware = (
  config: IConfig
): IRequestMiddleware<
  "IResponseErrorForbiddenNotAuthorized",
  HslJwtPayloadExtended
> =>
  jwtValidationMiddleware(
    config,
    hslJwtValidation(config),
    HslJwtPayloadExtended
  );
