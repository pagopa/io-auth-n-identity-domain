import prompts, { PromptObject } from "prompts";
import * as jose from "jose";
import { pipe } from "fp-ts/function";
import * as t from "io-ts";
import * as E from "fp-ts/lib/Either";
import * as TE from "fp-ts/lib/TaskEither";
import {
  LollipopSupportedKey,
  LollipopSupportedKeyAlgorithms,
  createKeyPairJWKTE,
  getErrorOrEncodedJwk,
  getThumbrint
} from "../lollipop";
import { decodeAnswers } from "../cli_prompts";

export type createKeyPairFlowResult = {
  publicKeyJwk: jose.JWK;
  privateKeyJwk: jose.JWK;
  encodedPublicKey: string;
  publicKeyThumbprint: string;
};

const createKeyPairPromptResponse = t.type({
  algorithm: LollipopSupportedKeyAlgorithms
});
export const createKeyPairFlow: TE.TaskEither<
  Error,
  createKeyPairFlowResult
> = pipe(
  TE.tryCatch(() => prompts(createKeyPairPrompt), E.toError),
  TE.chain(answers => decodeAnswers(answers, createKeyPairPromptResponse)),
  TE.chain(({ algorithm }) => createKeyPairJWKTE(algorithm)),
  TE.bind("encodedPrivateKey", ({ privateKeyJwk }) =>
    TE.fromEither(getErrorOrEncodedJwk(privateKeyJwk))
  ),
  TE.bind("encodedPublicKey", ({ publicKeyJwk }) =>
    TE.fromEither(getErrorOrEncodedJwk(publicKeyJwk))
  ),
  TE.bind("publicKeyThumbprint", ({ publicKeyJwk }) =>
    getThumbrint(publicKeyJwk)
  )
);

const createKeyPairPrompt: PromptObject = {
  name: "algorithm",
  message:
    "Before creating a keypair, please choose an algorithm supported by Lollipop",
  type: "autocomplete",
  choices: [
    { title: "NIST P-256", value: LollipopSupportedKey["NIST_P-256"] },
    { title: "RSA", value: LollipopSupportedKey.RSA }
  ]
};
