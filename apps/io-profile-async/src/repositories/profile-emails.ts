import * as RTE from "fp-ts/ReaderTaskEither";
import * as TE from "fp-ts/TaskEither";
import {
  IProfileEmailReader,
  IProfileEmailWriter,
  ProfileEmail,
  ProfileEmailWriterError
} from "@pagopa/io-functions-commons/dist/src/utils/unique_email_enforcement";
import { pipe } from "fp-ts/lib/function";

export type Dependencies = {
  readonly dataTableProfileEmailsRepository: IProfileEmailWriter &
    IProfileEmailReader;
};

const emailInsert: (
  profileEmail: ProfileEmail
) => RTE.ReaderTaskEither<Dependencies, Error, void> = profileEmail => ({
  dataTableProfileEmailsRepository
}) =>
  pipe(
    TE.tryCatch(
      () => dataTableProfileEmailsRepository.insert(profileEmail),
      error =>
        error instanceof Error
          ? error
          : new Error("error inserting ProfileEmail into table storage")
    ),
    TE.orElse(error =>
      ProfileEmailWriterError.is(error) && error.cause === "DUPLICATE_ENTITY"
        ? TE.right(void 0)
        : TE.left(error)
    )
  );

const emailDelete: (
  profileEmail: ProfileEmail
) => RTE.ReaderTaskEither<Dependencies, Error, void> = profileEmail => ({
  dataTableProfileEmailsRepository
}) =>
  pipe(
    TE.tryCatch(
      () => dataTableProfileEmailsRepository.delete(profileEmail),
      error =>
        error instanceof Error
          ? error
          : new Error("error deleting ProfileEmail from table storage")
    ),
    TE.orElse(error =>
      ProfileEmailWriterError.is(error) && error.cause === "ENTITY_NOT_FOUND"
        ? TE.right(void 0)
        : TE.left(error)
    )
  );

export type ProfileEmailRepository = typeof ProfileEmailRepository;
export const ProfileEmailRepository = { emailInsert, emailDelete };
