import express from "express";
import {
  ProfileModel,
  RetrievedProfile,
} from "@pagopa/io-functions-commons/dist/src/models/profile";
import { FiscalCodeMiddleware } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/fiscalcode";
import {
  asyncIteratorToArray,
  flattenAsyncIterator,
} from "@pagopa/io-functions-commons/dist/src/utils/async";
import {
  CosmosErrors,
  toCosmosErrorResponse,
} from "@pagopa/io-functions-commons/dist/src/utils/cosmosdb_model";
import {
  withRequestMiddlewares,
  wrapRequestHandler,
} from "@pagopa/io-functions-commons/dist/src/utils/request_middleware";

import {
  IResponseErrorQuery,
  ResponseErrorQuery,
} from "@pagopa/io-functions-commons/dist/src/utils/response";

import { IProfileEmailReader } from "@pagopa/io-functions-commons/dist/src/utils/unique_email_enforcement";

import {
  IResponseErrorInternal,
  IResponseErrorNotFound,
  IResponseSuccessJson,
  ResponseErrorInternal,
  ResponseSuccessJson,
} from "@pagopa/ts-commons/lib/responses";

import { FiscalCode } from "@pagopa/ts-commons/lib/strings";

import { isBefore } from "date-fns";
import { pipe, flow } from "fp-ts/lib/function";
import * as TE from "fp-ts/lib/TaskEither";
import * as RA from "fp-ts/lib/ReadonlyArray";
import * as E from "fp-ts/lib/Either";
import * as t from "io-ts";
import { readableReportSimplified } from "@pagopa/ts-commons/lib/reporters";
import { retrievedProfileToExtendedProfile } from "../utils/profiles";
import {
  PageQueryMiddleware,
  PageSizeQueryMiddleware,
} from "../utils/middlewares/pagination";
import { ProfilePageResults } from "../generated/definitions/internal-support/ProfilePageResults";
import { ExtendedProfile } from "../generated/definitions/internal-support/ExtendedProfile";
import { withIsEmailAlreadyTaken } from "./get-profile";

type IGetProfileVersionsHandlerResult =
  | IResponseSuccessJson<ProfilePageResults>
  | IResponseErrorInternal
  | IResponseErrorNotFound
  | IResponseErrorQuery;

/**
 * Type of a GetProfileVersions handler.
 *
 * GetProfileVersions expects a FiscalCode as input and returns a Profile or a Not Found error.
 */
type IGetProfileVersionsHandler = (
  fiscalCode: FiscalCode,
  page: number,
  pageSize: number,
) => Promise<IGetProfileVersionsHandlerResult>;

/**
 * Validates and processes retrieved profile items from Cosmos DB.
 * Converts io-ts validation results into a TaskEither, transforming validation errors into readable error messages.
 *
 * @param items - Array of validation results for retrieved profiles
 * @returns TaskEither with error or array of valid retrieved profiles
 */
const processedItems = (
  items: ReadonlyArray<t.Validation<RetrievedProfile>>,
): TE.TaskEither<Error, ReadonlyArray<RetrievedProfile>> =>
  pipe(
    items,
    E.sequenceArray,
    E.mapLeft(flow(readableReportSimplified, E.toError)),
    TE.fromEither,
  );

/**
 * Query the database for paginated profile versions.
 * Returns raw profile data from Cosmos DB.
 */
const queryProfileVersionsFromDatabase =
  (profileModel: ProfileModel) =>
  (
    fiscalCode: FiscalCode,
    page: number,
    pageSize: number,
  ): TE.TaskEither<
    IResponseErrorQuery,
    ReadonlyArray<t.Validation<RetrievedProfile>>
  > =>
    pipe(
      TE.tryCatch(
        async () =>
          profileModel
            .getQueryIterator({
              parameters: [
                {
                  name: "@fiscalCode",
                  value: fiscalCode,
                },
                {
                  name: "@offset",
                  value: (page - 1) * pageSize,
                },
                {
                  name: "@limit",
                  value: pageSize,
                },
              ],
              query: `SELECT * FROM p WHERE p.fiscalCode = @fiscalCode ORDER BY p._ts DESC OFFSET @offset LIMIT @limit`,
            })
            [Symbol.asyncIterator](),
        (_) => toCosmosErrorResponse(_) as CosmosErrors,
      ),
      TE.map(flattenAsyncIterator),
      TE.map(asyncIteratorToArray),
      TE.chain((i) =>
        TE.tryCatch(
          () => i,
          (_) => toCosmosErrorResponse(_) as CosmosErrors,
        ),
      ),
      TE.mapLeft((failure) =>
        ResponseErrorQuery("Error while retrieving the profile", failure),
      ),
    );

/**
 * Fetch paginated profile versions from the database.
 * Applies email opt-out logic and checks for duplicate emails.
 */
const fetchPaginatedProfileVersions =
  (
    profileModel: ProfileModel,
    optOutEmailSwitchDate: Date,
    profileEmailReader: IProfileEmailReader,
  ) =>
  (
    fiscalCode: FiscalCode,
    page: number,
    pageSize: number,
  ): TE.TaskEither<
    IResponseErrorInternal | IResponseErrorNotFound | IResponseErrorQuery,
    IResponseSuccessJson<ProfilePageResults>
  > =>
    pipe(
      queryProfileVersionsFromDatabase(profileModel)(
        fiscalCode,
        page,
        pageSize,
      ),
      TE.chainW(
        flow(
          processedItems,
          TE.mapLeft((_) =>
            ResponseErrorInternal("Error decoding retrieved profile versions"),
          ),
        ),
      ),
      TE.map(
        flow(
          (a) => a,
          // RA.rights,
          RA.map((p) =>
            pipe(
              // if profile's timestamp is before email opt out switch limit date we must force isEmailEnabled to false
              // this map is valid for ever so this check cannot be removed.
              // Please note that cosmos timestamps are expressed in unix notation (in seconds), so we must transform
              // it to a common Date representation (milliseconds).
              // eslint-disable-next-line no-underscore-dangle
              isBefore(p._ts * 1000, optOutEmailSwitchDate)
                ? { ...p, isEmailEnabled: false }
                : p,
              retrievedProfileToExtendedProfile,
            ),
          ),
        ),
      ),
      TE.chainW((profiles) =>
        TE.traverseArray(withIsEmailAlreadyTaken(profileEmailReader))(profiles),
      ),
      TE.map((a) =>
        ResponseSuccessJson({
          items: a as ReadonlyArray<ExtendedProfile>,
          page,
          page_size: pageSize,
          has_more: a.length === pageSize,
        }),
      ),
    );

/**
 * Return a GetProfileVersions handler.
 */
export function GetProfileVersionsHandler(
  profileModel: ProfileModel,
  optOutEmailSwitchDate: Date,
  profileEmailReader: IProfileEmailReader,
): IGetProfileVersionsHandler {
  const fetchVersions = fetchPaginatedProfileVersions(
    profileModel,
    optOutEmailSwitchDate,
    profileEmailReader,
  );
  return async (fiscalCode, page, pageSize) =>
    pipe(fetchVersions(fiscalCode, page, pageSize), TE.toUnion)();
}

/**
 * Wraps a GetProfileVersions handler inside an Express request handler.
 */
export function GetProfileVersions(
  profileModel: ProfileModel,
  optOutEmailSwitchDate: Date,
  profileEmailReader: IProfileEmailReader,
): express.RequestHandler {
  const handler = GetProfileVersionsHandler(
    profileModel,
    optOutEmailSwitchDate,
    profileEmailReader,
  );
  const middlewaresWrap = withRequestMiddlewares(
    FiscalCodeMiddleware,
    PageQueryMiddleware,
    PageSizeQueryMiddleware,
  );
  return wrapRequestHandler(middlewaresWrap(handler));
}
