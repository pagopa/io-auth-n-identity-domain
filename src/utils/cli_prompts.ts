import prompts, { PromptObject } from "prompts";
import * as t from "io-ts";
import * as TE from "fp-ts/TaskEither";
import * as E from "fp-ts/lib/Either";
import { pipe } from "fp-ts/function";
import { readableReportSimplified } from "@pagopa/ts-commons/lib/reporters";
import {
  createKeyPairFlow,
  createKeyPairFlowResult
} from "./flows/createKeyPair";
import { signFlow, signFlowResult } from "./flows/sign";

enum Flows {
  signFlow = "Sign",
  loginFlow = "Login",
  keyPairFlow = "KeyPairCreation"
}

export const flowChoosing: PromptObject = {
  name: "flow",
  message: "What flow do you want to initiate?",
  type: "autocomplete",
  choices: [
    { title: "Sign", value: Flows.signFlow },
    { title: "Login", value: Flows.loginFlow },
    { title: "Keypair creation", value: Flows.keyPairFlow }
  ]
};

export const flowChoiceDecoder = t.union([
  t.literal(Flows.signFlow),
  t.literal(Flows.loginFlow),
  t.literal(Flows.keyPairFlow)
]);

export const decodeAnswers: <A>(
  input: unknown,
  schema: t.Decoder<unknown, A>
) => TE.TaskEither<Error, A> = (input, schema) =>
  pipe(
    input,
    schema.decode,
    TE.fromEither,
    TE.mapLeft(
      errors =>
        new Error(
          `Unable to decode ${schema.name}: ${readableReportSimplified(errors)}`
        )
    )
  );

export type promptsResult =
  | signFlowResult
  | createKeyPairFlowResult
  | "Flow not yet implemented";

export const run = async () =>
  pipe(
    TE.tryCatch(() => prompts(flowChoosing), E.toError),
    TE.chain(answer => decodeAnswers(answer.flow, flowChoiceDecoder)),
    TE.chain<Error, Flows, promptsResult>(choice => {
      switch (choice) {
        case Flows.signFlow:
          return signFlow;
        case Flows.keyPairFlow:
          return createKeyPairFlow;
        default:
          return TE.right("Flow not yet implemented");
      }
    })
  )();
