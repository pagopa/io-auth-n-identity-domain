import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { enumType } from "@pagopa/ts-commons/lib/types";
import * as t from "io-ts";

export enum LoginTypeEnum {
  "LV" = "LV",
  "LEGACY" = "LEGACY",
}
export type LoginTypeT = t.TypeOf<typeof LoginType>;
export const LoginType = enumType<LoginTypeEnum>(LoginTypeEnum, "LoginType");

export type AdditionalLoginPropsT = t.TypeOf<typeof AdditionalLoginProps>;
export const AdditionalLoginProps = t.partial({ loginType: LoginType });

export const FastLoginResponse = t.type({
  token: NonEmptyString,
});
export type FastLoginResponse = t.TypeOf<typeof FastLoginResponse>;
