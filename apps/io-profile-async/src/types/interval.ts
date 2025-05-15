import { DateFromTimestamp } from "@pagopa/ts-commons/lib/dates";
import * as t from "io-ts";

export const Interval = t.type({
  from: DateFromTimestamp,
  to: DateFromTimestamp
});

export type Interval = t.TypeOf<typeof Interval>;

/**
 * Returns an Interval from midnight of the given date to midnight of the next day.
 *
 * @param date The date to create the interval from
 * @returns An Interval object with the start and end dates
 */
export const createInterval = (date: Date): Interval => {
  const from = new Date(date.setHours(0, 0, 0, 0));
  const to = new Date(date.setHours(24, 0, 0, 0));
  return { from, to };
};
