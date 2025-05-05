import * as H from "@pagopa/handler-kit";
import { lookup } from "fp-ts/lib/Record";
import { flow } from "fp-ts/lib/function";
import * as RTE from "fp-ts/lib/ReaderTaskEither";
import * as TE from "fp-ts/TaskEither";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { Decoder } from "io-ts";
import * as E from "fp-ts/Either";

export const RequiredPathParamMiddleware: <T>(
  schema: Decoder<unknown, T>,
  pathParamName: NonEmptyString,
) => RTE.ReaderTaskEither<H.HttpRequest, H.HttpBadRequestError, T> = (
  schema,
  pathParamName,
) =>
  flow(
    (req) => req.path,
    lookup(pathParamName),
    TE.fromOption(
      () =>
        new H.HttpBadRequestError(
          `Missing "${pathParamName}" in path parameters`,
        ),
    ),
    TE.chainEitherK(
      flow(
        H.parse(schema, `Invalid "${pathParamName}" supplied`),
        E.mapLeft((err) => new H.HttpBadRequestError(err.message)),
      ),
    ),
  );
