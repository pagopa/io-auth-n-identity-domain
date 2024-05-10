import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";

import { AssertionRefSha256 } from "../generated/backend/AssertionRefSha256";
import { AssertionTypeEnum } from "../generated/lollipop-api/AssertionType";
import { LcParams } from "../generated/lollipop-api/LcParams";
import { PubKeyStatusEnum } from "../generated/lollipop-api/PubKeyStatus";
import { AssertionFileName } from "../generated/lollipop-api/AssertionFileName";

import { aFiscalCode } from "./user.mocks";

export const anAssertionRef =
  "sha256-6LvipIvFuhyorHpUqK3HjySC5Y6gshXHFBhU9EJ4DoM=" as AssertionRefSha256;

const aBearerToken = "aBearerTokenJWT" as NonEmptyString;
const aPubKey = "aPubKey" as NonEmptyString;
export const aValidLCParamsResult: LcParams = {
  fiscal_code: aFiscalCode,
  assertion_file_name: `${aFiscalCode}-${anAssertionRef}` as AssertionFileName,
  assertion_type: AssertionTypeEnum.SAML,
  expired_at: new Date(),
  lc_authentication_bearer: aBearerToken as NonEmptyString,
  assertion_ref: anAssertionRef,
  pub_key: aPubKey,
  status: PubKeyStatusEnum.VALID,
  version: 1 as NonNegativeInteger,
  ttl: 900 as NonNegativeInteger,
};
