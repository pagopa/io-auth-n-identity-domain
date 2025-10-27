import { IPString, PatternString } from "@pagopa/ts-commons/lib/strings";
import { enumType } from "@pagopa/ts-commons/lib/types";
import * as t from "io-ts";

export enum RejectedLoginCauseEnum {
  AGE_BLOCK = "age_block",
  AUTH_LOCK = "auth_lock",
  CF_MISMATCH = "cf_mismatch",
}

export type RejectedLoginCause = t.TypeOf<typeof RejectedLoginCause>;
export const RejectedLoginCause = enumType<RejectedLoginCauseEnum>(
  RejectedLoginCauseEnum,
  "RejectedLoginCause",
);

export const RejectedLoginEventContent = t.intersection([
  t.type({
    // Date of the SPID request / response in YYYY-MM-DD format
    createdAtDay: PatternString("^[0-9]{4}-[0-9]{2}-[0-9]{2}$"),

    // IP of the client that made a SPID login action
    ip: t.string.pipe(IPString),

    // XML payload of the SPID Request
    requestPayload: t.string,

    // XML payload of the SPID Response
    responsePayload: t.string,

    // SPID request id
    spidRequestId: t.union([t.undefined, t.string]),
  }),
  t.partial({
    // The fiscal code of the currently authenticated user in the app.
    currentFiscalCode: t.string, // TODO: move from session manager the Sha256HexString io-ts type in this lib
  }),
]);
export type RejectedLoginEventContent = t.TypeOf<
  typeof RejectedLoginEventContent
>;
