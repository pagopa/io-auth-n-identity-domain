import {
  ProfileModel,
  PROFILE_MODEL_PK_FIELD,
  Profile
} from "@pagopa/io-functions-commons/dist/src/models/profile";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as O from "fp-ts/lib/Option";
import * as TE from "fp-ts/TaskEither";
import * as E from "fp-ts/lib/Either";
import { pipe } from "fp-ts/lib/function";
import { DocumentSearchKey } from "@pagopa/io-functions-commons/dist/src/utils/cosmosdb_model";
import { readableReportSimplified } from "@pagopa/ts-commons/lib/reporters";
import { cosmosErrorsToString } from "../utils/cosmos/errors";
import { OnProfileUpdateDocument } from "../types/on-profile-update-input-document";

export type Dependencies = {
  readonly profileModel: ProfileModel;
};

const onProfileUpdateFindDocument: (
  searchInfo: DocumentSearchKey<Profile, "id", typeof PROFILE_MODEL_PK_FIELD>
) => RTE.ReaderTaskEither<
  Dependencies,
  Error,
  O.Option<OnProfileUpdateDocument>
> = searchInfo => deps =>
  pipe(
    deps.profileModel.find(searchInfo),
    TE.mapLeft(cosmosErrors => Error(cosmosErrorsToString(cosmosErrors))),
    TE.chain(
      O.fold(
        () => TE.right(O.none),
        profile =>
          pipe(
            OnProfileUpdateDocument.decode(profile),
            E.foldW(
              errors => TE.left(Error(readableReportSimplified(errors))),
              profileDocument => TE.right(O.some(profileDocument))
            )
          )
      )
    )
  );

export const ProfileRepository = {
  onProfileUpdateFindDocument
};
