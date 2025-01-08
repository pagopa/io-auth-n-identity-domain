import {
  IResponseErrorForbiddenNotAuthorized,
  IResponseErrorInternal,
  IResponseSuccessJson,
  ResponseErrorForbiddenNotAuthorized,
  ResponseErrorInternal,
  ResponseSuccessJson
} from "@pagopa/ts-commons/lib/responses";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import * as E from "fp-ts/Either";
import * as TE from "fp-ts/TaskEither";
import { flow, pipe } from "fp-ts/lib/function";

import { readableReportSimplified } from "@pagopa/ts-commons/lib/reporters";
import { getHubSpidLoginClient } from "../clients/hubSpidLogin";
import { IntrospectSuccessResponse } from "../generated/definitions/hub-spid-login/IntrospectSuccessResponse";
import { IConfig } from "./config";

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
