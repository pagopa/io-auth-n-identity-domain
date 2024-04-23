import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import { IResponseSuccessJson } from "@pagopa/ts-commons/lib/responses";
import * as E from "fp-ts/Either";
import { User } from "../types/user";
import { InitializedProfile } from "../generated/backend/InitializedProfile";
import { APIClient } from "../repositories/api";
import { getProfile } from "../services/profile";
import { ProfileWithEmailValidated } from "../types/profile";

export const profileWithEmailValidatedOrError =
  (apiClient: ReturnType<APIClient>) => (user: User) =>
    pipe(
      TE.tryCatch(
        () => getProfile(apiClient)(user),
        () => new Error("Error retrieving user profile"),
      ),
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
