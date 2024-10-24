#!/usr/bin/env node
import prompts from "prompts";
import { flow } from "fp-ts/function";
import * as E from "fp-ts/Either";
import { argv } from "yargs";
import { run } from "./utils/cli_prompts";

//override prompts with predefined values from argv
//arguments name are provided by the name of the prompt(e.g. flow for the flow choosing prompt)
prompts.override(argv);

run().then(
  flow(
    E.fold(
      error => {
        console.log(`Cannot continue due to error: ${error.message}`);
        return process.exit(1);
      },
      result => {
        console.log("Congrats, here is the result:");
        console.log(result);
        return process.exit(0);
      }
    )
  )
);
