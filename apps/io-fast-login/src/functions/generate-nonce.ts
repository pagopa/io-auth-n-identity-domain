import * as crypto from "crypto";
import { httpAzureFunction } from "@pagopa/handler-kit-azure-func";
import * as H from "@pagopa/handler-kit";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as TE from "fp-ts/TaskEither";
import { flow, pipe } from "fp-ts/lib/function";
import * as E from "fp-ts/Either";
import { readableReportSimplified } from "@pagopa/ts-commons/lib/reporters";
import { Nonce } from "../generated/definitions/models/Nonce";
import { GenerateNonceResponse } from "../generated/definitions/internal/GenerateNonceResponse";
import { errorToHttpError } from "../utils/errors";
import { create } from "../model/nonce";
import { RedisDependency } from "../utils/redis/dependency";

const generateNonce: () => RTE.ReaderTaskEither<
  RedisDependency,
  H.HttpError,
  Nonce
> = () => ({ redisClientTask }) =>
  pipe(
    TE.of(crypto.randomUUID({ disableEntropyCache: true })),
    TE.chainEitherK(
      flow(
        Nonce.decode,
        E.mapLeft(
          errors =>
            new H.HttpError(
              `Error generating the nonce: [${readableReportSimplified(
                errors
              )}]`
            )
        )
      )
    ),
    TE.chainFirst(nonce =>
      pipe(
        redisClientTask,
        TE.mapLeft(errorToHttpError),
        TE.chain(flow(create(nonce), TE.mapLeft(errorToHttpError)))
      )
    )
  );

export const makeGenerateNonce: H.Handler<
  H.HttpRequest,
  | H.HttpResponse<GenerateNonceResponse, 200>
  | H.HttpResponse<H.ProblemJson, H.HttpErrorStatusCode>,
  RedisDependency
> = H.of((req: H.HttpRequest) =>
  pipe(
    req,
    generateNonce,
    RTE.map(nonce => H.successJson({ nonce })),
    RTE.orElseW(error =>
      RTE.right(H.problemJson({ status: error.status, title: error.message }))
    )
  )
);

export const GenerateNonceFunction = httpAzureFunction(makeGenerateNonce);
