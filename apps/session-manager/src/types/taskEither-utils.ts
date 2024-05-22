import * as TE from "fp-ts/TaskEither";
import * as RTE from "fp-ts/ReaderTaskEither";

/**
 * Return the Right
 */
export type RightOf<T> =
  T extends TE.TaskEither<unknown, infer Right> ? Right : never;

export type DependencyOf<T> =
  T extends RTE.ReaderTaskEither<infer Deps, unknown, unknown> ? Deps : never;
