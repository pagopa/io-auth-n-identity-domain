import {
  IResponseSuccessJson,
  ResponseSuccessJson,
} from "@pagopa/ts-commons/lib/responses";
import { flow, pipe } from "fp-ts/function";
import * as E from "fp-ts/lib/Either";
import * as TE from "fp-ts/lib/TaskEither";
import * as RTE from "fp-ts/ReaderTaskEither";
import { readableReportSimplified } from "@pagopa/ts-commons/lib/reporters";
import { GenerateNonceResponse } from "../generated/fast-login-api/GenerateNonceResponse";
import { assertNever, readableProblem } from "../utils/errors";
import { getFnFastLoginAPIClient } from "../repositories/fast-login-api";

export const generateNonceEndpoint: RTE.ReaderTaskEither<
  {
    fnFastLoginAPIClient: ReturnType<getFnFastLoginAPIClient>;
  },
  Error,
  IResponseSuccessJson<GenerateNonceResponse>
> = ({ fnFastLoginAPIClient }) =>
  pipe(
    TE.tryCatch(
      () => fnFastLoginAPIClient.generateNonce({}),
      (_) => Error("Error while calling fast-login service"),
    ),
    TE.chainEitherK(
      E.mapLeft(
        flow(readableReportSimplified, (message) =>
          Error(`Unexpected response from fast-login service: ${message}`),
        ),
      ),
    ),
    TE.chain((response) => {
      switch (response.status) {
        case 200:
          return TE.right(ResponseSuccessJson(response.value));
        case 401:
          return TE.left(Error("Underlying API fails with an unexpected 401"));
        case 500:
          return TE.left(Error(readableProblem(response.value)));
        case 502:
        case 504:
          return TE.left(Error("An error occurred on upstream service"));
        default:
          return assertNever(response);
      }
    }),
  );
