import prompts, { PromptObject } from "prompts";
import {
  LollipopSupportedKeyAlgorithms,
  createKeyPairJWKTE,
  createLollipopHeaders,
  createUUIDV4Nonce,
  importBase64UrlJWKTE
} from "../lollipop";
import * as J from "fp-ts/Json";
import * as TE from "fp-ts/TaskEither";
import * as O from "fp-ts/lib/Option";
import * as B from "fp-ts/lib/boolean";
import * as E from "fp-ts/Either";
import { flow, pipe } from "fp-ts/function";
import { decodeAnswers } from "../cli_prompts";
import * as t from "io-ts";
import {
  LollipopMethod,
  LollipopMethodEnum
} from "../../generated/lollipop_definitions/LollipopMethod";
import { LollipopOriginalURL } from "../../generated/lollipop_definitions/LollipopOriginalURL";
import { LollipopUserId } from "../../generated/lollipop_definitions/LollipopUserId";
import {
  AssertionType,
  AssertionTypeEnum
} from "../../generated/lollipop_definitions/AssertionType";
import { UUIDv4Nonce } from "../../generated/lollipop_definitions/UUIDv4Nonce";
import { composeCurlForGenericSign } from "../curl/composition";
import { BooleanFromString } from "@pagopa/ts-commons/lib/booleans";

const SignAnswersDecoder = t.intersection([
  t.strict({
    "x-pagopa-lollipop-method": LollipopMethod,
    "x-pagopa-lollipop-original-url": LollipopOriginalURL,
    "x-pagopa-lollipop-user-id": LollipopUserId,
    "x-pagopa-lollipop-assertion-type": AssertionType,
    // when passing through the cli arguments, the value is ALWAYS taken as string type
    hasCustomKeyPair: t.union([BooleanFromString, t.boolean]),
    hasBody: t.union([BooleanFromString, t.boolean]),
    hasNonce: t.union([BooleanFromString, t.boolean])
  }),
  t.partial({
    nonce: t.string,
    body: t.string,
    CustomKeyPair: t.string,
    KeypairAlgorithm: LollipopSupportedKeyAlgorithms
  })
]);

export const parseNonceFromAnswers: (nonce: string) => string = nonce =>
  pipe(
    nonce,
    UUIDv4Nonce.decode,
    // fallback to user provided nonce
    E.getOrElse(_ => nonce)
  );

export const parseBodyFromAnswers: (
  body: string
) => E.Either<Error, J.Json> = body =>
  pipe(
    body,
    J.parse,
    E.mapLeft(
      flow(E.toError, error => `Body parsing error: ${error.message}`, Error)
    )
  );

const outputToCurlDecoder = t.type({
  outputToCurl: t.union([BooleanFromString, t.boolean])
});
const outputToCurlPrompt: PromptObject = {
  name: "outputToCurl",
  message:
    "Do you want to display the output inside a curl command?(defaults to no)",
  type: "confirm"
};

export type signFlowResult =
  | {
      digest?: string;
      signature: string;
      signatureInput: string;
    }
  | string;
export const signFlow: TE.TaskEither<Error, signFlowResult> = pipe(
  TE.tryCatch(() => prompts(SignFlowPrompts), E.toError),
  TE.chain(answers => decodeAnswers(answers, SignAnswersDecoder)),
  TE.bindTo("answers"),
  TE.bind("keyPair", ({ answers }) =>
    pipe(
      answers.hasCustomKeyPair,
      B.fold(
        () =>
          pipe(
            answers.KeypairAlgorithm,
            TE.fromNullable(new Error("KeypairAlgorithm can not be null")),
            TE.chain(createKeyPairJWKTE)
          ),
        () =>
          pipe(
            answers.CustomKeyPair,
            E.fromNullable(new Error("CustomKeyPair can not be null")),
            E.chain(importBase64UrlJWKTE),
            TE.fromEither
          )
      )
    )
  ),
  TE.bindW("maybeNonce", ({ answers }) =>
    pipe(answers.nonce, O.fromNullable, O.map(parseNonceFromAnswers), TE.of)
  ),
  TE.bind("maybeBody", ({ answers }) =>
    pipe(
      answers.body,
      O.fromNullable,
      O.fold(() => E.right(O.none), flow(parseBodyFromAnswers, E.map(O.some))),
      TE.fromEither
    )
  ),
  TE.bind("result", ({ answers, keyPair, maybeNonce, maybeBody }) =>
    createLollipopHeaders({
      method: answers["x-pagopa-lollipop-method"],
      privateKeyJwk: keyPair.privateKeyJwk,
      publicKeyJwk: keyPair.publicKeyJwk,
      url: answers["x-pagopa-lollipop-original-url"],
      body: O.getOrElseW(() => undefined)(maybeBody),
      nonce: O.getOrElseW(() => undefined)(maybeNonce)
    })
  ),
  // ask if user wants output to curl format
  TE.bind("hasCurlFormat", () =>
    pipe(
      TE.tryCatch(() => prompts(outputToCurlPrompt), E.toError),
      TE.chain(answers => decodeAnswers(answers, outputToCurlDecoder)),
      TE.map(decodedAnswer => decodedAnswer.outputToCurl)
    )
  ),
  //
  TE.map(({ hasCurlFormat, result, answers, maybeBody }) =>
    pipe(
      hasCurlFormat,
      B.foldW(
        () => result,
        () =>
          composeCurlForGenericSign({
            ...result,
            body: pipe(
              maybeBody,
              O.map(JSON.stringify),
              O.getOrElseW(() => undefined)
            ),
            destinationUrl: answers["x-pagopa-lollipop-original-url"],
            originalUrl: answers["x-pagopa-lollipop-original-url"],
            originalMethod: answers["x-pagopa-lollipop-method"]
          })
      )
    )
  )
);

const SignFlowPrompts: PromptObject[] = [
  {
    name: "x-pagopa-lollipop-method",
    message: `Welcome to LolliPoP playground. 
  Here you can easily forge a request for a lollipop consumer.
  Pick an HTTP method to start out`,
    type: "autocomplete",
    choices: [
      { title: "GET", value: LollipopMethodEnum.GET },
      { title: "POST", value: LollipopMethodEnum.POST },
      { title: "PUT", value: LollipopMethodEnum.PUT },
      { title: "PATCH", value: LollipopMethodEnum.PATCH },
      { title: "DELETE", value: LollipopMethodEnum.DELETE }
    ]
  },
  {
    name: "x-pagopa-lollipop-original-url",
    message: `Now you need to choose an URL for the request.
  Please input it below:`,
    type: "text",
    initial: "https://example.com",
    validate: value => {
      return typeof value === "string" && value.length > 0;
    }
  },
  {
    name: "x-pagopa-lollipop-user-id",
    message:
      "Would you like to insert a custom user-id? (defaults to a random fiscal code)",
    type: "text",
    initial: "SPNDNL80R13C555X"
  },
  {
    name: "x-pagopa-lollipop-assertion-type",
    message: "Choose the assertion type:",
    type: "autocomplete",
    choices: [
      { title: "SAML", value: AssertionTypeEnum.SAML },
      { title: "OIDC", value: AssertionTypeEnum.OIDC }
    ]
  },
  {
    name: "hasCustomKeyPair",
    type: "confirm",
    message: "Do you want to use a custom keypair?"
  },
  {
    name: "CustomKeyPair",
    message:
      "Insert the keypair(base64url formatted JWK)(public key, '#' character and then private key)",
    type: (_prev, values) =>
      (typeof values.hasCustomKeyPair === "boolean" &&
        values.hasCustomKeyPair === true) ||
      (typeof values.hasCustomKeyPair === "string" &&
        values.hasCustomKeyPair === "true")
        ? "text"
        : null
  },
  // only executes if the customkeypair didn't produce any result
  {
    name: "KeypairAlgorithm",
    message: "Choose an algorithm for the keypair from the ones supported",
    type: (_prev, values) =>
      (typeof values.hasCustomKeyPair === "boolean" &&
        values.hasCustomKeyPair === true) ||
      (typeof values.hasCustomKeyPair === "string" &&
        values.hasCustomKeyPair === "true")
        ? null
        : "autocomplete",
    choices: [
      { title: "ECDSA P-256", value: "ES256" },
      { title: "RSA", value: "RS256" }
    ]
  },
  {
    name: "hasBody",
    message: "Would you like to also sign the body?",
    type: "confirm"
  },
  {
    name: "body",
    message: "Paste the body(needs to be a JSON fromatted string):",
    type: prev => (typeof prev === "boolean" && prev === true ? "text" : null)
  },
  {
    name: "hasNonce",
    message:
      "Would you like to include a nonce to the signing request? (this is mandatory for some consumers)",
    type: "confirm"
  },
  {
    name: "nonce",
    message: "Insert nonce(defaults to UUID v4)",
    initial: createUUIDV4Nonce(),
    type: prev => (typeof prev === "boolean" && prev === true ? "text" : null)
  }
];
