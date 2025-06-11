import * as E from "fp-ts/lib/Either";
import { pipe } from "fp-ts/lib/function";
import * as O from "fp-ts/Option";
import { Errors } from "io-ts";
import { EventType } from "../types/auth-session-event";

export const validationErrorsContainsKnownEventType = (
  validationErrors: Errors,
): boolean =>
  pipe(
    validationErrors,
    O.fromPredicate((e) => e.length > 0),
    O.chain((e) => O.tryCatch(() => e[0].context[0].actual)),
    O.filter(
      (u): u is { eventType: unknown } =>
        typeof u === "object" && u !== null && "eventType" in u,
    ),
    O.map((u) => pipe(u.eventType, EventType.decode, E.isRight)),
    O.getOrElse(() => false),
  );
