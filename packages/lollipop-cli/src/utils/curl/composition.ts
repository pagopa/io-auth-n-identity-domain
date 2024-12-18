import * as S from "fp-ts/string";
import {
  LollipopMethod,
  LollipopMethodEnum
} from "../../generated/lollipop_definitions/LollipopMethod";
import { LollipopOriginalURL } from "../../generated/lollipop_definitions/LollipopOriginalURL";
import * as O from "fp-ts/lib/Option";
import { pipe } from "fp-ts/function";

export const COMMAND_PREFIX = "curl ";

// utils
export const concat = (...strings: string[]) =>
  strings.reduce((acc, curr) => S.Monoid.concat(acc, curr), "");
export const wrapWithNewLine = (i: string, backslash: boolean = true) =>
  `${i} ${backslash ? "\\" : ""}\n`;
export const addHeader = (
  headerName: string,
  headerValue: string,
  backslash: boolean = true
) => wrapWithNewLine(`-H '${headerName}:${headerValue}'`, backslash);

export const addMethod = (method: LollipopMethod) =>
  wrapWithNewLine(`-X ${method}`, true);
export const addLocation = (url: string) => wrapWithNewLine(`-L ${url}`, true);
export const addBody = (body: string) => wrapWithNewLine(`-d ${body}`, true);
//

// methods for curl composing for some use cases
type LoginInput = {
  destinationUrl: string;
  encodedPublicKey: string;
  publicKeyHashAlgorithm: "sha256" | "sha384" | "sha512";
  loginType: "LV" | "LEGACY";
  method: LollipopMethodEnum;
};
export const composeCurlForLogin = (input: LoginInput) =>
  concat(
    COMMAND_PREFIX,
    addMethod(input.method),
    addLocation(input.destinationUrl),
    addHeader("Accept", "application/json"),
    addHeader("x-pagopa-lollipop-pub-key", input.encodedPublicKey),
    addHeader("x-pagopa-lollipop-login-type", input.loginType),
    addHeader(
      "x-pagopa-lollipop-pub-key-hash-algo",
      input.publicKeyHashAlgorithm
    )
  );

type GenericSignInput = {
  destinationUrl: string;
  originalMethod: LollipopMethodEnum;
  originalUrl: LollipopOriginalURL;
  signatureInput: string;
  signature: string;
  digest?: string;
  body?: string;
};
export const composeCurlForGenericSign = (input: GenericSignInput) =>
  concat(
    COMMAND_PREFIX,
    addMethod(input.originalMethod),
    addLocation(input.destinationUrl),
    addHeader("Accept", "application/json"),
    addHeader("x-pagopa-lollipop-original-method", input.originalMethod),
    addHeader("x-pagopa-lollipop-original-url", input.originalUrl),
    addHeader("signature-input", input.signatureInput),
    addHeader("signature", input.signature),
    pipe(
      input.digest,
      O.fromNullable,
      O.map(d => addHeader("content-digest", d)),
      O.getOrElse(() => "")
    ),
    pipe(
      input.digest,
      O.fromNullable,
      O.chainNullableK(() => input.body),
      O.map(b => addBody(b)),
      O.getOrElse(() => "")
    ),
    pipe(
      input.digest,
      O.fromNullable,
      O.map(_ => addHeader("content-type", "application/json")),
      O.getOrElse(() => "")
    ),
    addHeader("authorization", "Bearer <INSERT_TOKEN_HERE>", false)
  );
