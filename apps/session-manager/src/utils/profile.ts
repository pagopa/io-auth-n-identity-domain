import * as E from "fp-ts/Either";
import * as TE from "fp-ts/TaskEither";
import { pipe } from "fp-ts/function";
import * as RTE from "fp-ts/ReaderTaskEither";
import { IResponseSuccessJson } from "@pagopa/ts-commons/lib/responses";
import { FnAppRepo } from "../repositories";
import { ProfileWithEmailValidated } from "../types/profile";
import { ProfileService } from "../services";
import { InitializedProfile } from "../generated/backend/InitializedProfile";
import { WithUser } from "./user";

export const profileWithEmailValidatedOrError: RTE.ReaderTaskEither<
  FnAppRepo.FnAppAPIRepositoryDeps & WithUser,
  Error,
  ProfileWithEmailValidated
> = (deps) =>
  pipe(
    ProfileService.getProfile(deps),
    TE.chain(
      TE.fromPredicate(
        (r): r is IResponseSuccessJson<InitializedProfile> =>
          r.kind === "IResponseSuccessJson",
        (e) => new Error(`Error retrieving user profile | ${e.detail}`),
      ),
    ),
    TE.chainW((profile) =>
      pipe(
        profile.value,
        ProfileWithEmailValidated.decode,
        E.mapLeft(
          (_) => new Error("Profile has not a validated email address"),
        ),
        TE.fromEither,
      ),
    ),
  );
