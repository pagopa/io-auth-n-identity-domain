import { AssertionRef } from "@pagopa/io-functions-commons/dist/generated/definitions/lollipop/AssertionRef";
import { JwkPublicKey } from "@pagopa/ts-commons/lib/jwk";
import { JwkPubKeyHashAlgorithmEnum } from "../../generated/definitions/internal/JwkPubKeyHashAlgorithm";
import { getAlgoFromAssertionRef, getAllAssertionsRef } from "../lollipopKeys";
import * as jose from "jose";
import * as E from "fp-ts/Either";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";

const aValidAssertionRef = "sha256-9f86d081884c7d659a2feaa0c55ad015a3bf4f1234" as AssertionRef;
const aValidSha512AssertionRef = "sha512-9f86d081884c7d659a2feaa0c55ad015a3bf4f1234abcdaacabac8734623984f" as AssertionRef;

const anInvalidJwk: JwkPublicKey = {
  alg: "",
  e: "e",
  kty: "RSA",
  n: ""
};

const aValidJwk: JwkPublicKey = {
  kty: "EC",
  crv: "P-256",
  x: "SVqB4JcUD6lsfvqMr-OKUNUphdNn64Eay60978ZlL74",
  y: "lf0u0pMj4lGAzZix5u4Cm5CMQIgMNpkwy163wtKYVKI"
};

const usedAlgo = JwkPubKeyHashAlgorithmEnum.sha256;
const masterAlgo = JwkPubKeyHashAlgorithmEnum.sha512;

describe("getAllAssertionsRef", () => {
  it("GIVEN a valid pubKey WHEN master key's thumbprint generation fails THEN it should return an Error", async () => {
    const result = await getAllAssertionsRef(
      masterAlgo,
      usedAlgo,
      anInvalidJwk
    )();
    expect(E.isLeft(result)).toBeTruthy();
    if (E.isLeft(result)) {
      expect(result.left.message).toEqual(
        expect.stringContaining("Can not calculate JwkThumbprint ")
      );
    }
  });

  it("GIVEN a valid pubKey WHEN masterAlgo match THEN it should return only master assertionRef", async () => {
    const result = await getAllAssertionsRef(
      masterAlgo,
      masterAlgo,
      aValidJwk
    )();

    const expectedMasterAssertionThumbprint = await jose.calculateJwkThumbprint(
      aValidJwk,
      masterAlgo
    );
    expect(E.isRight(result)).toBeTruthy();
    if (E.isRight(result)) {
      expect(result.right).toEqual({
        master: `${masterAlgo}-${expectedMasterAssertionThumbprint}`
      });
    }
  });

  it("GIVEN a valid pubKey WHEN masterAlgo does not match THEN it should return master and used assertionsRef", async () => {
    const result = await getAllAssertionsRef(masterAlgo, usedAlgo, aValidJwk)();

    const expectedMasterAssertionThumbprint = await jose.calculateJwkThumbprint(
      aValidJwk,
      masterAlgo
    );
    const expectedUsedAssertionThumbprint = await jose.calculateJwkThumbprint(
      aValidJwk,
      usedAlgo
    );
    expect(E.isRight(result)).toBeTruthy();
    if (E.isRight(result)) {
      expect(result.right).toEqual({
        master: `${masterAlgo}-${expectedMasterAssertionThumbprint}`,
        used: `${usedAlgo}-${expectedUsedAssertionThumbprint}`
      });
    }
  });
});
