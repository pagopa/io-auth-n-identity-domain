import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { enumType } from "@pagopa/ts-commons/lib/types";
import * as t from "io-ts";

export enum LoginTypeEnum {
  "LV" = "LV",
  "LEGACY" = "LEGACY",
}
export type LoginTypeT = t.TypeOf<typeof LoginType>;
export const LoginType = enumType<LoginTypeEnum>(LoginTypeEnum, "LoginType");

// Additional properties that can be passed to the login endpoint and propagated to the assertionConsumerService
// Pay attention: on decode failure the error will be ignored, nothing will be propagated to the assertionConsumerService,
// but the login still succeeds, https://github.com/pagopa/io-spid-commons/blob/0e80cb12ab8140cc5160be7e09aa419e60c7e012/src/strategy/saml_client.ts#L143
export type AdditionalLoginPropsT = t.TypeOf<typeof AdditionalLoginProps>;
export const AdditionalLoginProps = t.partial({
  loginType: LoginType,
  currentUser: NonEmptyString,
});

export const FastLoginResponse = t.type({
  token: NonEmptyString,
});
export type FastLoginResponse = t.TypeOf<typeof FastLoginResponse>;
