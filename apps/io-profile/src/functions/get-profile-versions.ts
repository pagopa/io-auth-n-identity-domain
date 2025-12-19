import express from "express";
import {
  NonNegativeInteger,
  NonNegativeIntegerFromString,
} from "@pagopa/ts-commons/lib/numbers";
import { OptionalQueryParamMiddleware } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/optional_query_param";
import { ExtendedProfile } from "@pagopa/io-functions-commons/dist/generated/definitions/ExtendedProfile";
import { ProfileModel } from "@pagopa/io-functions-commons/dist/src/models/profile";
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
  ResponseSuccessJson,
} from "@pagopa/ts-commons/lib/responses";

import { FiscalCode } from "@pagopa/ts-commons/lib/strings";

import { isBefore } from "date-fns";
import { pipe } from "fp-ts/lib/function";
import * as O from "fp-ts/lib/Option";
import * as TE from "fp-ts/lib/TaskEither";
import * as E from "fp-ts/lib/Either";
import * as t from "io-ts";
import { retrievedProfileToExtendedProfile } from "../utils/profiles";
import { withIsEmailAlreadyTaken } from "./get-profile";

const ProfilePageResults = t.intersection([
  t.interface({
    items: t.readonlyArray(ExtendedProfile),
  }),
  t.partial({
    page: t.number,
    page_size: t.number,
    has_more: t.boolean,
  }),
]);

type ProfilePageResults = t.TypeOf<typeof ProfilePageResults>;

type IGetProfileVersionsHandlerResult =
  | IResponseSuccessJson<ProfilePageResults>
  | IResponseErrorInternal
  | IResponseErrorNotFound
  | IResponseErrorQuery;

/**
 * Type of a GetProfileVersions handler.
 *
 * GetProfileVersions expects a FiscalCode as input and returns a Profile or
 * a Not Found error.
 */
type IGetProfileVersionsHandler = (
  fiscalCode: FiscalCode,
  maybePage: O.Option<NonNegativeInteger>,
  maybePageSize: O.Option<NonNegativeInteger>,
) => Promise<IGetProfileVersionsHandlerResult>;

/**
 * Return a type safe GetProfileVersions handler.
 */
export function GetProfileVersionsHandler(
  profileModel: ProfileModel,
  optOutEmailSwitchDate: Date,
  profileEmailReader: IProfileEmailReader,
): IGetProfileVersionsHandler {
  return async (fiscalCode, maybePage, maybePageSize) =>
    pipe(
      TE.Do,
      TE.bind("page_size", () => TE.of(O.getOrElse(() => 25)(maybePageSize))),
      TE.bind("page", () => TE.of(O.getOrElse(() => 1)(maybePage))),
      TE.chain(({ page, page_size }) =>
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
                      value: (page - 1) * page_size,
                    },
                    {
                      name: "@limit",
                      value: page_size,
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
          TE.map((values) =>
            values.filter(E.isRight).map((_) =>
              pipe(
                _.right,
                (p) =>
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
          TE.chainW((profiles) =>
            TE.traverseArray(withIsEmailAlreadyTaken(profileEmailReader))(
              profiles,
            ),
          ),
          TE.map((a) =>
            ResponseSuccessJson({
              items: a,
              page,
              page_size,
              has_more: a.length === page_size,
            }),
          ),
        ),
      ),
      TE.toUnion,
    )();
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
    OptionalQueryParamMiddleware("page", NonNegativeIntegerFromString),
    OptionalQueryParamMiddleware("page_size", NonNegativeIntegerFromString),
  );
  return wrapRequestHandler(middlewaresWrap(handler));
}
