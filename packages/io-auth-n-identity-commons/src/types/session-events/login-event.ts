import { DateFromTimestamp } from "@pagopa/ts-commons/lib/dates";
import { enumType } from "@pagopa/ts-commons/lib/types";
import * as t from "io-ts";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import { EventTypeEnum } from "./event-type";
export enum LoginTypeEnum {
  LEGACY = "legacy",
  LV = "lv",
}

export type LoginType = t.TypeOf<typeof LoginType>;
export const LoginType = enumType<LoginTypeEnum>(LoginTypeEnum, "LoginType");

export enum LoginScenarioEnum {
  NEW_USER = "new_user",
  STANDARD = "standard",
  RELOGIN = "relogin",
}

export type LoginScenario = t.TypeOf<typeof LoginScenario>;
export const LoginScenario = enumType<LoginScenarioEnum>(
  LoginScenarioEnum,
  "LoginScenario",
);

export const LoginEvent = t.type({
  eventType: t.literal(EventTypeEnum.LOGIN),
  fiscalCode: FiscalCode,
  ts: DateFromTimestamp,
  expiredAt: DateFromTimestamp,
  loginType: LoginType,
  scenario: LoginScenario,
  idp: t.string,
});
export type LoginEvent = t.TypeOf<typeof LoginEvent>;
