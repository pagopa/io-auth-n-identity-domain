import * as t from "io-ts";
import { PatternString } from "@pagopa/ts-commons/lib/strings";

export const LeasePrefix = PatternString("^[A-Za-z0-9_-]+$");
export type LeasePrefix = t.TypeOf<typeof LeasePrefix>;