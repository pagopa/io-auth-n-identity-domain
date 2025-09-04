import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import * as E from "fp-ts/Either";
import * as RTE from "fp-ts/ReaderTaskEither";
import { errorsToReadableMessages } from "@pagopa/ts-commons/lib/reporters";
import { UserLoginParams } from "../generated/io-profile/UserLoginParams";
import { FnAppAPIRepositoryDeps } from "../repositories/fn-app-api";

export const onUserLogin: (
  data: UserLoginParams,
) => RTE.ReaderTaskEither<FnAppAPIRepositoryDeps, Error, boolean> =
  (body) => (deps) =>
    pipe(
      TE.tryCatch(
        () => deps.fnAppAPIClient.startNotifyLoginProcess({ body }),
        (_) =>
          new Error(`Error calling startNotifyLoginProcess: ${E.toError(_)}`),
      ),
      TE.chainEitherKW(
        E.mapLeft(
          (_) =>
            new Error(
              `Error decoding startNotifyLoginProcess response: ${errorsToReadableMessages(
                _,
              )}`,
            ),
        ),
      ),
      TE.chain((response) =>
        response.status === 202
          ? TE.of(true)
          : TE.left(
              new Error(`startNotifyLoginProcess returned ${response.status}`),
            ),
      ),
    );
