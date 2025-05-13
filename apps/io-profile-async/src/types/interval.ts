import { DateFromTimestamp } from "@pagopa/ts-commons/lib/dates";
import * as t from "io-ts";

export const Interval = t.type({
  from: DateFromTimestamp,
  to: DateFromTimestamp
});

export type Interval = t.TypeOf<typeof Interval>;
