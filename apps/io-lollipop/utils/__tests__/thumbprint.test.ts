import {
  aJwkPubKey,
  aSha256PubKeyThumbprint,
  aSha384PubKeyThumbprint,
  aSha512PubKeyThumbprint
} from "../../__mocks__/jwkMock";
import { calculateThumbprint, encodeBase64 } from "../thumbprint";
import { JwkPublicKey } from "@pagopa/ts-commons/lib/jwk";
import { JwkPubKeyHashAlgorithmEnum } from "../../generated/definitions/internal/JwkPubKeyHashAlgorithm";

describe("calculateThumbprint", () => {
  test.each([
    {
      algo: JwkPubKeyHashAlgorithmEnum.sha256,
      expected: aSha256PubKeyThumbprint
    },
    {
      algo: JwkPubKeyHashAlgorithmEnum.sha384,
      expected: aSha384PubKeyThumbprint
    },
    {
      algo: JwkPubKeyHashAlgorithmEnum.sha512,
      expected: aSha512PubKeyThumbprint
    }
  ])(
    "GIVEN a valid jwk WHEN calculateThumbprint with algo $algo THEN return the thumbprint of the jwk",
    async ({ algo, expected }) => {
      const jwk = aJwkPubKey;
      const result = await calculateThumbprint(algo)(jwk)();
      expect(result).toEqual(expect.objectContaining({ right: expected }));
    }
  );
});

describe("encodeBase64", () => {
  test("GIVEN a valid jwk WHEN encodeBase64 THEN return the json of the jwk encoded in base64", async () => {
    const jwk = aJwkPubKey;
    const result = encodeBase64(jwk);
    const decoded = Buffer.from(result, "base64").toString("utf-8");
    expect(JwkPublicKey.decode(JSON.parse(decoded))).toEqual(
      expect.objectContaining({ right: jwk })
    );
  });
});
