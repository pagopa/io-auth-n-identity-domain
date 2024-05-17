import * as RTE from "fp-ts/ReaderTaskEither";
import * as TE from "fp-ts/TaskEither";
import * as E from "fp-ts/Either";
import {
  IResponseErrorValidation,
  IResponseSuccessJson,
  ResponseSuccessJson,
} from "@pagopa/ts-commons/lib/responses";
import { pipe } from "fp-ts/function";
import { Second } from "@pagopa/ts-commons/lib/units";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { RedisRepositoryDeps } from "../repositories/redis";
import { WithUser } from "../utils/user";
import { FnAppAPIRepositoryDeps } from "../repositories/fn-app-api";
import { ValidZendeskProfile } from "../types/profile";
import { TokenService } from "../services";
import { ZendeskToken } from "../generated/zendesk/ZendeskToken";
import { WithExpressRequest } from "../utils/express";
import { profileWithEmailValidatedOrError } from "../utils/profile";

type GetZendeskSupportTokenHandler = RTE.ReaderTaskEither<
  {
    jwtZendeskSupportTokenSecret: NonEmptyString;
    jwtZendeskSupportTokenExpiration: Second;
    jwtZendeskSupportTokenIssuer: NonEmptyString;
  } & RedisRepositoryDeps &
    FnAppAPIRepositoryDeps &
    WithUser &
    WithExpressRequest,
  Error,
  IResponseErrorValidation | IResponseSuccessJson<ZendeskToken>
>;

export const getZendeskSupportToken: GetZendeskSupportTokenHandler = (deps) =>
  pipe(
    profileWithEmailValidatedOrError({ ...deps }),
    TE.mapLeft((e) =>
      Error(
        `Error retrieving a user profile with validated email address | ${e.message}`,
      ),
    ),
    TE.chainW((profileWithValidEmailAddress) =>
      TE.fromEither(
        pipe(
          ValidZendeskProfile.decode(profileWithValidEmailAddress),
          E.mapLeft(() =>
            Error("Cannot create a valid Zendesk user from this profile"),
          ),
        ),
      ),
    ),
    TE.chainW((validZendeskProfile) =>
      TokenService.getJwtZendeskSupportToken(
        deps.jwtZendeskSupportTokenSecret,
        validZendeskProfile.name,
        validZendeskProfile.family_name,
        validZendeskProfile.fiscal_code,
        validZendeskProfile.email,
        deps.jwtZendeskSupportTokenExpiration,
        deps.jwtZendeskSupportTokenIssuer,
      ),
    ),
    TE.map((token) =>
      ZendeskToken.encode({
        jwt: token,
      }),
    ),
    // TODO: track event in case of error(obfuscating the fiscalcode)
    TE.map(ResponseSuccessJson),
  );
