import {
  IResponseSuccessJson,
  ResponseSuccessJson,
} from "@pagopa/ts-commons/lib/responses";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as TE from "fp-ts/TaskEither";
import { pipe } from "fp-ts/function";
import { readableReportSimplified } from "@pagopa/ts-commons/lib/reporters";
import { WithUser } from "../utils/user";
import { WithExpressRequest } from "../utils/express";
import { BPDUser } from "../generated/bpd/BPDUser";

type GetUserForBPDHandler = RTE.ReaderTaskEither<
  WithUser & WithExpressRequest,
  Error,
  IResponseSuccessJson<BPDUser>
>;

/**
 * Returns the profile for the user identified by the provided fiscal
 * code.
 */
export const getUserForBPD: GetUserForBPDHandler = (deps) =>
  pipe(
    // t.exact here will ensure extra properties are removed
    // except for the ones needed
    BPDUser.decode(deps.user),
    TE.fromEither,
    TE.map(ResponseSuccessJson),
    TE.mapLeft((errors) => Error(readableReportSimplified(errors))),
  );
