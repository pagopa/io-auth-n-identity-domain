import * as H from "@pagopa/handler-kit";
import { flow } from "fp-ts/lib/function";
import * as RTE from "fp-ts/lib/ReaderTaskEither";
import * as TE from "fp-ts/TaskEither";
import { Decoder } from "io-ts";
import * as E from "fp-ts/Either";

export const RequiredBodyMiddleware: <T>(
  schema: Decoder<unknown, T>,
) => RTE.ReaderTaskEither<H.HttpRequest, H.HttpBadRequestError, T> = (schema) =>
  flow(
    (req) => req.body,
    H.parse(schema, "Missing or invalid body"),
    E.mapLeft((error) => new H.HttpBadRequestError(error.message)),
    TE.fromEither,
  );
