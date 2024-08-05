import { pipe } from "fp-ts/function";
import * as E from "fp-ts/lib/Either";

// Just a bunch of types needed for creating a tuple from an union type
// See https://www.hacklewayne.com/typescript-convert-union-to-tuple-array-yes-but-how
type Contra<T> = T extends any ? (arg: T) => void : never;
type InferContra<T> = [T] extends [(arg: infer I) => void] ? I : never;
type PickOne<T> = InferContra<InferContra<Contra<Contra<T>>>>;
export type Union2Tuple<T> =
  PickOne<T> extends infer U // assign PickOne<T> to U
    ? Exclude<T, U> extends never // T and U are the same
      ? [T]
      : [...Union2Tuple<Exclude<T, U>>, U] // recursion
    : never;
// --------------

// Concat over a defined string array
export type Concat<T extends string[]> = T extends [infer F, ...infer R]
  ? F extends string
    ? R extends string[]
      ? R extends []
        ? `${F}`
        : `${F},${Concat<R>}`
      : never
    : never
  : "";

export const parseFilter = (filter: string): E.Either<Error, Set<string>> =>
  pipe(
    filter
      // clear parentheses and empty spaces
      .replace(/\(|\)|\s/g, "")
      // separate fields
      .split(",")
      // filter out empty string
      .filter((s) => s.length > 0),
    (fieldsToTake) => new Set(fieldsToTake),
    E.fromPredicate(
      (fieldsToTake) => fieldsToTake.size > 0,
      () => Error("0 Parameters provided to fields filter"),
    ),
  );
