import {
  ProfileModel,
  Profile
} from "@pagopa/io-functions-commons/dist/src/models/profile";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as O from "fp-ts/lib/Option";
import * as TE from "fp-ts/TaskEither";
import * as E from "fp-ts/lib/Either";
import { pipe } from "fp-ts/lib/function";
import { readableReportSimplified } from "@pagopa/ts-commons/lib/reporters";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import { generateVersionedModelId } from "@pagopa/io-functions-commons/dist/src/utils/cosmosdb_model_versioned";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import { cosmosErrorsToString } from "../utils/cosmos/errors";
import { OnProfileUpdateDocument } from "../types/on-profile-update-input-document";

export type Dependencies = {
  readonly profileModel: ProfileModel;
};

const onProfileUpdateFindDocument: (
  fiscalCode: FiscalCode,
  version: NonNegativeInteger
) => RTE.ReaderTaskEither<
  Dependencies,
  Error,
  O.Option<OnProfileUpdateDocument>
> = (fiscalCode, version) => deps =>
  pipe(
    generateVersionedModelId<Profile, "fiscalCode">(fiscalCode, version),
    id => deps.profileModel.find([id, fiscalCode]),
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

export type ProfileRepository = typeof ProfileRepository;
export const ProfileRepository = {
  onProfileUpdateFindDocument
};
