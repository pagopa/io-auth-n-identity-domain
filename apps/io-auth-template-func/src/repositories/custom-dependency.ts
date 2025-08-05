import * as TE from "fp-ts/lib/TaskEither";
export type CustomDependencyRepositoryDeps = object;

const ping: (
  _deps: CustomDependencyRepositoryDeps,
) => TE.TaskEither<Error, true> = () => TE.right(true as const);

export type CustomDependencyRepository = typeof CustomDependencyRepository;
export const CustomDependencyRepository = {
  ping,
};
