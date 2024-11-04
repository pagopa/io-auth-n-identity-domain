import * as H from "@pagopa/handler-kit";
import { lookup } from "fp-ts/lib/Record";
import { flow } from "fp-ts/lib/function";
import * as RTE from "fp-ts/lib/ReaderTaskEither";
import * as TE from "fp-ts/TaskEither";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { Decoder } from "io-ts";
import * as E from "fp-ts/Either";

export const RequiredHeaderMiddleware: <T>(
  schema: Decoder<unknown, T>,
  headerName: NonEmptyString
) => RTE.ReaderTaskEither<H.HttpRequest, H.HttpBadRequestError, T> = <T>(
  schema: Decoder<unknown, T>,
  headerName: NonEmptyString
) =>
  flow(
    req => req.headers,
    lookup(headerName),
    TE.fromOption(
      () => new H.HttpBadRequestError(`Missing "${headerName}" in headers`)
    ),
    TE.chainEitherK(
      flow(
        H.parse(schema, `Invalid "${headerName}" supplied in header`),
        E.mapLeft(err => new H.HttpBadRequestError(err.message))
      )
    )
  );

export const RequiredHeadersMiddleware: <T>(
  schema: Decoder<unknown, T>
) => RTE.ReaderTaskEither<H.HttpRequest, H.HttpBadRequestError, T> = <T>(
  schema: Decoder<unknown, T>
) =>
  flow(
    req => req.headers,
    H.parse(schema, `Missing or invalid LolliPoP Headers`),
    E.mapLeft(err => new H.HttpBadRequestError(err.message)),
    TE.fromEither
  );

export const RequiredBodyMiddleware: <T>(
  schema: Decoder<unknown, T>
) => RTE.ReaderTaskEither<H.HttpRequest, H.HttpBadRequestError, T> = schema =>
  flow(
    req => req.body,
    H.parse(schema, "Missing or invalid body"),
    E.mapLeft(error => new H.HttpBadRequestError(error.message)),
    TE.fromEither
  );
