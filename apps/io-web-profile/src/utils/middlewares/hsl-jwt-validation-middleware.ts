import { getValidateJWT } from "@pagopa/ts-commons/lib/jwt_with_key_rotation";
import {
  getResponseErrorForbiddenNotAuthorized,
  IResponseErrorForbiddenNotAuthorized
} from "@pagopa/ts-commons/lib/responses";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import * as TE from "fp-ts/TaskEither";
import { pipe } from "fp-ts/lib/function";
import * as jwt from "jsonwebtoken";

import { IRequestMiddleware } from "@pagopa/io-functions-commons/dist/src/utils/request_middleware";
import { enumType } from "@pagopa/ts-commons/lib/types";
import * as t from "io-ts";
import { IConfig } from "../config";
import { SpidLevel } from "../enums/SpidLevels";
import { BaseJwtPayload, jwtValidationMiddleware } from "../jwt";
import { introspectionCall } from "../introspection-call";

export const HslJwtPayloadExtended = t.intersection([
  BaseJwtPayload,
  t.type({
    spid_level: enumType(SpidLevel, "spidLevel")
  })
]);
export type HslJwtPayloadExtended = t.TypeOf<typeof HslJwtPayloadExtended>;

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
