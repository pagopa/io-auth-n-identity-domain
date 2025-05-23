import * as RTE from "fp-ts/lib/ReaderTaskEither";
import * as TE from "fp-ts/lib/TaskEither";
import { pipe } from "fp-ts/lib/function";
import {
  CustomDependencyRepository,
  CustomDependencyRepositoryDeps,
} from "../repositories/custom-dependency";

export type InfoServiceDeps = CustomDependencyRepositoryDeps & {
  CustomDependencyRepository: CustomDependencyRepository;
};

const pingCustomDependency: RTE.ReaderTaskEither<
  InfoServiceDeps,
  Error,
  "PONG"
> = (deps) =>
  pipe(
    deps.CustomDependencyRepository.ping(deps),
    // Custom mapping happening here
    TE.map(() => "PONG" as const),
    TE.mapLeft((err) => Error(`InfoService returned ${err.message}`)),
  );

export type InfoService = typeof InfoService;
export const InfoService = {
  pingCustomDependency,
};
