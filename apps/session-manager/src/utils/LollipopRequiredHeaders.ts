import * as t from "io-ts";
import { LollipopSignature } from "../generated/fast-login-api/LollipopSignature";
import { LollipopSignatureInput } from "../generated/fast-login-api/LollipopSignatureInput";
import { LollipopMethod } from "../generated/fast-login-api/LollipopMethod";
import { LollipopOriginalURL } from "../generated/fast-login-api/LollipopOriginalURL";
import { LollipopContentDigest } from "../generated/lollipop/LollipopContentDigest";

export const LollipopRequiredHeaders = t.intersection([
  t.type({
    signature: LollipopSignature,
    ["signature-input"]: LollipopSignatureInput,
    ["x-pagopa-lollipop-original-method"]: LollipopMethod,
    ["x-pagopa-lollipop-original-url"]: LollipopOriginalURL,
  }),
  t.partial({ ["content-digest"]: LollipopContentDigest }),
]);
