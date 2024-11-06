import { flow, pipe } from "fp-ts/function";
import * as E from "fp-ts/lib/Either";
import * as O from "fp-ts/lib/Option";
import { readableReportSimplified } from "@pagopa/ts-commons/lib/reporters";
import { Nonce } from "../../generated/definitions/models/Nonce";
import { LollipopSignatureInput } from "../../generated/definitions/internal/LollipopSignatureInput";
const nonceRegex = new RegExp('nonce="(.*?)"');

export const getNonceFromSignatureInput = (
  signatureInput: LollipopSignatureInput
): E.Either<Error, Nonce> =>
  pipe(
    signatureInput.match(nonceRegex),
    O.fromNullable,
    // take out only the first group of the match
    O.chainNullableK(matchArray => matchArray.at(1)),
    E.fromOption(
      () => new Error("Could not retrieve nonce from signature-input.")
    ),
    E.chain(
      flow(
        Nonce.decode,
        E.mapLeft(
          errors =>
            new Error(
              `Error while decoding nonce: [${readableReportSimplified(
                errors
              )}]`
            )
        )
      )
    )
  );
