import * as TE from "fp-ts/TaskEither";

/**
 * Return the Right
 */
export type RightOf<T> = T extends TE.TaskEither<unknown, infer _> ? _ : never;
