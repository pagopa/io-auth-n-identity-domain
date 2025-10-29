import { pipe } from "fp-ts/lib/function";
import * as O from "fp-ts/Option";
import * as t from "io-ts";
import { Errors } from "io-ts";
import { EventType } from "../types/session-events/event-type";

const WithKnownEventType = t.type({
  eventType: EventType,
});
type WithKnownEventType = t.TypeOf<typeof WithKnownEventType>;

export const validationErrorsContainsKnownEventType = (
  validationErrors: Errors,
): boolean =>
  pipe(
    O.tryCatch(() => validationErrors[0].context[0].actual),
    O.map(WithKnownEventType.is),
    O.getOrElse(() => false),
  );
