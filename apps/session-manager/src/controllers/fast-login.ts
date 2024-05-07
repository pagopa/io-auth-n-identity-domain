import {
  IResponseErrorForbiddenNotAuthorized,
  IResponseErrorInternal,
  IResponseSuccessJson,
  ResponseErrorInternal,
  ResponseSuccessJson,
} from "@pagopa/ts-commons/lib/responses";
import { flow, pipe } from "fp-ts/function";
import * as E from "fp-ts/lib/Either";
import * as TE from "fp-ts/lib/TaskEither";
import * as RTE from "fp-ts/ReaderTaskEither";
import { readableReportSimplified } from "@pagopa/ts-commons/lib/reporters";
import { GenerateNonceResponse } from "../generated/fast-login-api/GenerateNonceResponse";
import { readableProblem } from "../utils/errors";
import {
  IResponseErrorUnauthorized,
  ResponseErrorStatusNotDefinedInSpec,
  ResponseErrorUnexpectedAuthProblem,
} from "../utils/responses";
import { getFastLoginLollipopConsumerClient } from "../repositories/fast-login-api";

export const generateNonceEndpoint: RTE.ReaderTaskEither<
  {
    client: ReturnType<getFastLoginLollipopConsumerClient>;
  },
  Error,
  | IResponseErrorUnauthorized
  | IResponseErrorForbiddenNotAuthorized
  | IResponseErrorInternal
  | IResponseSuccessJson<GenerateNonceResponse>
> = ({ client }) =>
  TE.tryCatch(
    async () =>
      pipe(
        TE.tryCatch(
          () => client.generateNonce({}),
          (_) =>
            ResponseErrorInternal("Error while calling fast-login service"),
        ),
        TE.chainEitherKW(
          E.mapLeft(
            flow(readableReportSimplified, (message) =>
              ResponseErrorInternal(
                `Unexpected response from fast-login service: ${message}`,
              ),
            ),
          ),
        ),
        TE.chainW((response) => {
          switch (response.status) {
            case 200:
              return TE.right(ResponseSuccessJson(response.value));
            case 401:
              return TE.left(ResponseErrorUnexpectedAuthProblem());
            case 500:
              return TE.left(
                ResponseErrorInternal(readableProblem(response.value)),
              );
            case 502:
            case 504:
              return TE.left(
                ResponseErrorInternal("An error occurred on upstream service"),
              );
            default:
              return TE.left(ResponseErrorStatusNotDefinedInSpec(response));
          }
        }),
        TE.toUnion,
      )(),
    (e) => Error(String(e)),
  );
