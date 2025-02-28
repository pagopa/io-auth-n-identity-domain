import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import {
  EmailString,
  FiscalCode,
  NonEmptyString
} from "@pagopa/ts-commons/lib/strings";
import { withDefault } from "@pagopa/ts-commons/lib/types";
import * as t from "io-ts";

export const ProfileDocument = t.intersection([
  t.type({
    _self: NonEmptyString,
    fiscalCode: FiscalCode,
    isEmailValidated: withDefault(t.boolean, true),
    version: NonNegativeInteger
  }),
  t.partial({
    email: EmailString
  })
]);

export type ProfileDocument = t.TypeOf<typeof ProfileDocument>;

export const OnProfileUpdateFunctionInput = t.readonlyArray(t.unknown);
export type OnProfileUpdateFunctionInput = t.TypeOf<
  typeof OnProfileUpdateFunctionInput
>;
