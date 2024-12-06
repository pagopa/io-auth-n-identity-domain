/* eslint-disable sort-keys */
// TODO: Move this file into io-functions-commons
import { IRequestMiddleware } from "@pagopa/io-functions-commons/dist/src/utils/request_middleware";
import { ResponseErrorFromValidationErrors } from "@pagopa/ts-commons/lib/responses";
import { pipe } from "fp-ts/lib/function";
import * as t from "io-ts";
import * as E from "fp-ts/Either";
import { FiscalCode, NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { AssertionRef } from "../../generated/definitions/external/AssertionRef";
import { AssertionType } from "../../generated/definitions/internal/AssertionType";
import { JwkPubKeyToken } from "../../generated/definitions/internal/JwkPubKeyToken";
import { LollipopMethod } from "../../generated/definitions/lollipop-first-consumer/LollipopMethod";
import { LollipopOriginalURL } from "../../generated/definitions/lollipop-first-consumer/LollipopOriginalURL";
import { LollipopSignatureInput } from "../../generated/definitions/lollipop-first-consumer/LollipopSignatureInput";
import { LollipopSignature } from "../../generated/definitions/lollipop-first-consumer/LollipopSignature";

/**
 * Returns a request middleware that extract an optional
 * parameter in the request.header.
 *
 * @param name  The name of the header
 * @param type  The io-ts Type for validating the parameter
 */
export const RequiredHeaderMiddleware = <S, A>(
  name: string,
  type: t.Type<A, S>
): IRequestMiddleware<"IResponseErrorValidation", A> => async (
  request
): ReturnType<IRequestMiddleware<"IResponseErrorValidation", A>> =>
  pipe(
    request.header(name),
    type.decode,
    E.mapLeft(ResponseErrorFromValidationErrors(type))
  );

export const RequiredHeadersMiddleware = <S, A>(
  type: t.Type<A, S>
): IRequestMiddleware<"IResponseErrorValidation", A> => async (
  request
): ReturnType<IRequestMiddleware<"IResponseErrorValidation", A>> =>
  pipe(
    request.headers,
    type.decode,
    E.mapLeft(ResponseErrorFromValidationErrors(type))
  );

export const LollipopHeaders = t.type({
  ["x-pagopa-lollipop-assertion-ref"]: AssertionRef,
  ["x-pagopa-lollipop-assertion-type"]: AssertionType,
  ["x-pagopa-lollipop-user-id"]: FiscalCode,
  ["x-pagopa-lollipop-public-key"]: JwkPubKeyToken,
  ["x-pagopa-lollipop-auth-jwt"]: NonEmptyString,
  ["x-pagopa-lollipop-original-method"]: LollipopMethod,
  ["x-pagopa-lollipop-original-url"]: LollipopOriginalURL,
  ["signature-input"]: LollipopSignatureInput,
  ["signature"]: LollipopSignature
});
export type LollipopHeaders = t.TypeOf<typeof LollipopHeaders>;
