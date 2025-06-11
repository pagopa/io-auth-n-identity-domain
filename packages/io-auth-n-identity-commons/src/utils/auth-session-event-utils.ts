import * as E from "fp-ts/lib/Either";
import { flow, pipe } from "fp-ts/lib/function";
import * as O from "fp-ts/Option";
import * as t from "io-ts";
import { Errors } from "io-ts";
import { EventType } from "../types/auth-session-event";

const WithKnownEventType = t.type({
  eventType: EventType,
});
type WithKnownEventType = t.TypeOf<typeof WithKnownEventType>;

export const validationErrorsContainsKnownEventType = (
  validationErrors: Errors,
): boolean =>
  pipe(
    O.tryCatch(() => validationErrors[0].context[0].actual),
    O.map(flow(WithKnownEventType.decode, E.isRight)),
    O.getOrElse(() => false),
  );
