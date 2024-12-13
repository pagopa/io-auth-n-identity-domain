import { JwkPublicKey } from "@pagopa/ts-commons/lib/jwk";
import * as TE from "fp-ts/TaskEither";
import { flow, pipe } from "fp-ts/lib/function";
import * as E from "fp-ts/Either";
import * as O from "fp-ts/Option";
import { FiscalCode, NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { LCUserInfo } from "../../generated/definitions/fn-lollipop/LCUserInfo";
import { SamlUserInfo } from "../../generated/definitions/fn-lollipop/SamlUserInfo";
import {
  AssertionType,
  AssertionTypeEnum
} from "../../generated/definitions/internal/AssertionType";
import {
  JwkPubKeyHashAlgorithm,
  JwkPubKeyHashAlgorithmEnum
} from "../../types/lollipop";
import { AssertionRef } from "../../generated/definitions/fn-lollipop/AssertionRef";
import { AssertionRefSha256 } from "../../generated/definitions/internal/AssertionRefSha256";
import { AssertionRefSha384 } from "../../generated/definitions/internal/AssertionRefSha384";
import { AssertionRefSha512 } from "../../generated/definitions/internal/AssertionRefSha512";
import { calculateThumbprint } from "./crypto";

export const isAssertionSaml = (type: AssertionType) => (
  assertion: LCUserInfo
): assertion is SamlUserInfo =>
  type === AssertionTypeEnum.SAML && SamlUserInfo.is(assertion);

export const calculateAssertionRef = (algo: JwkPubKeyHashAlgorithm) => (
  jwkPublicKey: JwkPublicKey
): TE.TaskEither<Error, AssertionRef> =>
  pipe(
    jwkPublicKey,
    calculateThumbprint(algo),
    TE.chainEitherK(
      flow(
        thumbprint => `${algo}-${thumbprint}`,
        AssertionRef.decode,
        E.mapLeft(() => Error("Cannot decode master AssertionRef"))
      )
    )
  );

export const algoToAssertionRefSet = new Set([
  { algo: JwkPubKeyHashAlgorithmEnum.sha256, type: AssertionRefSha256 },
  { algo: JwkPubKeyHashAlgorithmEnum.sha384, type: AssertionRefSha384 },
  { algo: JwkPubKeyHashAlgorithmEnum.sha512, type: AssertionRefSha512 }
]);

const SAML_NAMESPACE = {
  ASSERTION: "urn:oasis:names:tc:SAML:2.0:assertion",
  PROTOCOL: "urn:oasis:names:tc:SAML:2.0:protocol"
};

export const getAlgoFromAssertionRef = (
  assertionRef: AssertionRef
): JwkPubKeyHashAlgorithm =>
  pipe(
    Array.from(algoToAssertionRefSet),
    ar => ar.find(entry => entry.type.is(assertionRef)),
    O.fromNullable,
    O.map(pubKeyHashAlgo => pubKeyHashAlgo.algo),
    O.getOrElseW(() => void 0 as never)
  );

export const getFiscalNumberFromSamlResponse = (
  doc: Document
): O.Option<FiscalCode> =>
  pipe(
    O.fromNullable(
      doc.getElementsByTagNameNS(SAML_NAMESPACE.ASSERTION, "Attribute")
    ),
    O.chainNullableK(collection =>
      Array.from(collection).find(
        elem => elem.getAttribute("Name") === "fiscalNumber"
      )
    ),
    O.chainNullableK(fiscalCodeElement =>
      fiscalCodeElement.textContent?.trim().replace("TINIT-", "")
    ),
    O.chain(fiscalCode => O.fromEither(FiscalCode.decode(fiscalCode)))
  );

export const getAttributeFromSamlResponse = (
  tagName: string,
  attrName: string
) => (doc: Document): O.Option<string> =>
  pipe(
    O.fromNullable(
      doc.getElementsByTagNameNS(SAML_NAMESPACE.ASSERTION, tagName).item(0)
    ),
    O.chain(element =>
      O.fromEither(NonEmptyString.decode(element.getAttribute(attrName)))
    )
  );

export const getRequestIDFromSamlResponse = getAttributeFromSamlResponse(
  "SubjectConfirmationData",
  "InResponseTo"
);
