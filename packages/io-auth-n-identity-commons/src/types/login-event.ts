import { DateFromTimestamp } from "@pagopa/ts-commons/lib/dates";
import { enumType } from "@pagopa/ts-commons/lib/types";
import * as t from "io-ts";
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

export const LoginEventContent = t.type({
  expiredAt: DateFromTimestamp,
  loginType: LoginType,
  scenario: LoginScenario,
  idp: t.string,
});
export type LoginEventContent = t.TypeOf<typeof LoginEventContent>;
