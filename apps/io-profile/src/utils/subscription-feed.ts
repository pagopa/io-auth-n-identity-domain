import { Context } from "@azure/functions";
import { TableService, TableUtilities } from "azure-storage";

import * as A from "fp-ts/lib/Array";
import * as E from "fp-ts/lib/Either";
import { pipe } from "fp-ts/lib/function";
import * as O from "fp-ts/lib/Option";
import * as TE from "fp-ts/lib/TaskEither";

import { ServiceId } from "@pagopa/io-functions-commons/dist/generated/definitions/ServiceId";
import { IResponseErrorQuery } from "@pagopa/io-functions-commons/dist/src/utils/response";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import { FiscalCode, NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import * as t from "io-ts";
import { updateSubscriptionFeed } from "../functions/update-subscriptions-feed-activity";
import { deleteTableEntity, insertTableEntity } from "./storage";
import { createTracker } from "./tracking";

const eg = TableUtilities.entityGenerator;

export const SubscriptionFeedEntitySelector = t.type({
  partitionKey: t.string,
  rowKey: t.string,
});
export type SubscriptionFeedEntitySelector = t.TypeOf<
  typeof SubscriptionFeedEntitySelector
>;

/**
 * Updates the subscrption status of a user.
 *
 * User subscribed or unsubscribed events are stored as empty entities in an
 * Azure storage table.
 *
 * The entity key is composed by the day of the event, the service ID (if it's
 * a service subscription event), a character that indicates whether it's a
 * subscribed (S) or unsubscribed (U) event and the SHA256 hash of the fiscal
 * code of the user.
 *
 * For each day, (optionally) service and user, either the S or the U key exist,
 * but not both (it would not make sense).
 *
 * When the key does not include a service ID, it refers to a profile
 * subscription event, meaning the user registered to IO (subscribed) or deleted
 * her account (unsubscribed).
 * When the key includes the service ID, it refers to a service subscription
 * event, meaning the user activated (subscribed) or deactivated (unsubscribed)
 * a specific service.
 */
export const updateSubscriptionStatus =
  (tableService: TableService, tableName: NonEmptyString) =>
  async (
    context: Context,
    logPrefix: string,
    version: number,
    deleteEntity: SubscriptionFeedEntitySelector,
    deleteOtherEntities: ReadonlyArray<SubscriptionFeedEntitySelector>,
    insertEntity: SubscriptionFeedEntitySelector,
    allowInsertIfDeleted: boolean,
    // eslint-disable-next-line max-params
  ): Promise<true> => {
    const insertEntityHandler = insertTableEntity(tableService, tableName);
    const deleteEntityHandler = deleteTableEntity(tableService, tableName);
    // First we try to delete a previous (un)subscriptions operation
    // from the subscription feed entries for the current day
    const deleteResults = await pipe(
      A.sequence(TE.ApplicativeSeq)(
        [deleteEntity, ...deleteOtherEntities].map((_) =>
          TE.tryCatch(
            async () => {
              // First we try to delete a previous (un)subscriptions operation
              // from the subscription feed entries for the current day
              context.log.verbose(
                `${logPrefix}|KEY=${_.rowKey}|Deleting entity`,
              );
              const { e1: maybeError2, e2: uResponse2 } =
                await deleteEntityHandler({
                  PartitionKey: eg.String(_.partitionKey),
                  RowKey: eg.String(_.rowKey),
                });
              return { maybeError: maybeError2, uResponse: uResponse2 };
            },
            () => new Error("Error calling the delete entity handler"),
          ),
        ),
      ),
      TE.getOrElse((error) => {
        throw error;
      }),
    )();

    // If deleteEntity is successful it means the user
    // previously made an opposite choice (in the same day).
    // Since we're going to expose only the delta for this day,
    // and we've just deleted the opposite operation, we go on here.
    if (!allowInsertIfDeleted && O.isNone(deleteResults[0].maybeError)) {
      return true;
    }

    if (
      deleteResults.some(
        (_) =>
          // _.uResponse could be null
          O.isSome(_.maybeError) &&
          _.uResponse &&
          _.uResponse.statusCode !== 404,
      )
    ) {
      // retry
      const errors = new Error(
        deleteResults
          .map((_) => _.maybeError)
          .filter(O.isSome)
          .map((_) => _.value.message)
          .join("|"),
      );
      context.log.error(`${logPrefix}|ERROR=${errors.message}}`);
      throw errors;
    }

    // If deleteEntity has not found any entry or insert is required,
    // we insert the new (un)subscription entry into the feed
    context.log.verbose(
      `${logPrefix}|KEY=${insertEntity.rowKey}|Inserting entity`,
    );
    const { e1: resultOrError, e2: sResponse } = await insertEntityHandler({
      PartitionKey: eg.String(insertEntity.partitionKey),
      RowKey: eg.String(insertEntity.rowKey),
      version: eg.Int32(version),
    });
    // sResponse could be null
    if (E.isLeft(resultOrError) && sResponse && sResponse.statusCode !== 409) {
      // retry
      context.log.error(`${logPrefix}|ERROR=${resultOrError.left.message}`);
      throw resultOrError.left;
    }

    return true;
  };

export const UpdateSubscriptionFeedInput = t.type({
  fiscalCode: FiscalCode,
  operation: t.union([t.literal("SUBSCRIBED"), t.literal("UNSUBSCRIBED")]),
  serviceId: ServiceId,
  subscriptionKind: t.literal("SERVICE"),
  updatedAt: t.number,
  version: NonNegativeInteger,
});

export type UpdateSubscriptionFeedInput = t.TypeOf<
  typeof UpdateSubscriptionFeedInput
>;

export const updateSubscriptionFeedTask = (
  tableService: TableService,
  subscriptionFeedTable: NonEmptyString,
  context: Context,
  input: UpdateSubscriptionFeedInput,
  logPrefix: string,
  tracker: ReturnType<typeof createTracker>,
  // eslint-disable-next-line max-params
): TE.TaskEither<IResponseErrorQuery, boolean> =>
  pipe(
    TE.tryCatch(
      () =>
        updateSubscriptionFeed(
          context,
          input,
          tableService,
          subscriptionFeedTable,
        ),
      E.toError,
    ),
    TE.fold(
      (err) => {
        context.log.verbose(
          `${logPrefix}| Error while trying to update subscriptionFeed|ERROR=${err.message}`,
        );
        tracker.subscriptionFeed.trackSubscriptionFeedFailure(
          input,
          "EXCEPTION",
        );
        return TE.of(false);
      },
      (result) => {
        const isSuccess = result === "SUCCESS";
        if (!isSuccess) {
          context.log.verbose(
            `${logPrefix}| Error while trying to update subscriptionFeed|ERROR=${"FAILURE"}`,
          );
          tracker.subscriptionFeed.trackSubscriptionFeedFailure(
            input,
            "FAILURE",
          );
        }
        return TE.of(isSuccess);
      },
    ),
  );
