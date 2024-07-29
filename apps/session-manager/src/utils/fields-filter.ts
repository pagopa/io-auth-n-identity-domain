import { pipe } from "fp-ts/function";
import * as E from "fp-ts/lib/Either";

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
