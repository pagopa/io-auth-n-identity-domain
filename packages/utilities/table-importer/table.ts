/* eslint-disable no-console */
/* eslint-disable functional/no-let */
import { TableClient } from "@azure/data-tables";
import * as TE from "fp-ts/TaskEither";
import * as E from "fp-ts/Either";
import * as ROA from "fp-ts/ReadonlyArray";
import { pipe } from "fp-ts/function";
import { LockedProfile } from "./types";

const copyEntity = (
  entity: LockedProfile,
  destinationClient: TableClient,
): TE.TaskEither<Error, void> =>
  pipe(
    TE.tryCatch(
      async () => {
        await destinationClient.createEntity(entity);
      },
      (err) =>
        new Error(
          `Failed pk=${entity.partitionKey} rk=${entity.rowKey}: ${String(
            err,
          )}`,
        ),
    ),
  );

export const copyTableData = (
  originClient: TableClient,
  destinationClient: TableClient,
): TE.TaskEither<ReadonlyArray<Error>, void> =>
  pipe(
    TE.tryCatch(
      async () => {
        let errors: ReadonlyArray<Error> = [];
        let counter = 0;

        for await (const page of originClient
          .listEntities<LockedProfile>()
          .byPage({ maxPageSize: 1000 })) {
          for (const entity of page) {
            const result = await copyEntity(entity, destinationClient)();
            counter++;

            errors = pipe(
              result,
              E.fold(
                (err) => ROA.append(err)(errors),
                () => errors,
              ),
            );
            if (counter % 100 === 0) {
              console.log(
                `Processed ${counter} entities so far with ${ROA.size(errors)} errors...`,
              );
            }
          }
        }
        console.log(
          `Processed ${counter} entities in total with ${ROA.size(errors)} errors!`,
        );
        return errors;
      },
      (err) => [err as Error],
    ),
    TE.chain((errors) =>
      ROA.isEmpty(errors)
        ? TE.right<ReadonlyArray<Error>, void>(void 0)
        : TE.left<ReadonlyArray<Error>, void>(errors),
    ),
  );
